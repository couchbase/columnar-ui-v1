if (!('console' in window))
  window.console = {log: function () {}};

function getBacktrace() {
  try {
    throw new Error();
  } catch (e) {
    return e.stack;
  }
};

function traceMethodCalls(object, methodName) {
  var original = object[methodName];
  function tracer() {
    var args = $.makeArray(arguments);
    console.log("traceIn:",object,".",methodName,"(",args,")");
    try {
      var rv = original.apply(this, arguments);
      console.log("traceOut: rv = ",rv);
      return rv;
    } catch (e) {
      console.log("traceExc: e = ", e);
      throw e;
    }
  }
  object[methodName] = tracer;
}

// creates function with body of F, but environment ENV
// USE WITH EXTREME CARE
function reinterpretInEnv(f, env) {
  var keys = [];
  var vals = [];
  for (var k in env) {
    keys.push(k);
    vals.push(env[k]);
  }
  var body = 'return ' + String(f);
  body = body.replace(/^return function\s+[^(]*\(/m, 'return function (');
  var maker = Function.apply(Function, keys.concat([body]));
  return maker.apply(null, vals);
}

// ;(function () {
//   var f = function () {
//     alert('f:' + f);
//   }
//   f();
//   reinterpretInEnv(f, {f: 'alk'})();
// })();

function escapeHTML() {
  return String(arguments[0]).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
}

function escapeJS(string) {
  return String(string).replace(/\\/g, '\\\\').replace(/["']/g, '\\$&');
}

function renderJSLink(functionName, arg, prefix) {
  prefix = prefix || "javascript:"
  return escapeHTML(prefix + functionName + "('" + escapeJS(arg) + "')")
}

_.template = function (str, data) {
  function translateTemplate(templ) {
    var openRE = /{%=?/g;
    var closeRE = /%}/g;

    var len = templ.length;
    var match, match2;
    var str;

    var res = ['var p=[],print=function(){p.push.apply(p,arguments);};',
               'with(obj){'];
    var literals = {};
    var toPush;

    closeRE.lastIndex = 0;

    while (closeRE.lastIndex < len) {
      openRE.lastIndex = closeRE.lastIndex;

      match = openRE.exec(templ);
      if (!match)
        str = templ.slice(closeRE.lastIndex);
      else
        str = templ.slice(closeRE.lastIndex, match.index);

      function addOut(expr) {
        if (!toPush)
          res.push(toPush = []);
        toPush.push(expr);
      }

      var id = _.uniqueId("__STR");
      literals[id] = str;

      addOut(id);

      if (!match)
        break;

      closeRE.lastIndex = openRE.lastIndex;
      match2 = closeRE.exec(templ);

      if (!match2)
        throw new Error("missing %}");

      str = templ.slice(openRE.lastIndex, match2.index);
      if (match[0] == '{%=') {
        addOut(str);
      } else {
        res.push(str);
        toPush = null;
      }
    }

    res.push("};\nreturn p.join('');"); // close 'with'

    var body = _.map(res, function (e) {
      if (e instanceof Array) {
        return "p.push(" + e.join(", ") + ");"
      }
      return e;
    }).join("\n");

    return [body, literals];
  }

  try {
    var arr = translateTemplate(str);
    var body = arr[0];
    var literals = arr[1];
    // add some common helpers into scope
    _.extend(literals, {
      h: escapeHTML,
      V: ViewHelpers,
      jsLink: renderJSLink});

    var fn = reinterpretInEnv("function (obj) {\n" + body + "\n}", literals);
  } catch (e) {
    try {
      e.templateBody = body;
      e.templateSource = str;
    } catch (e2) {} // sometimes exceptions do not allow expando props
    throw e;
  }

  return data ? fn(data) : fn;
}

// Based on: http://ejohn.org/blog/javascript-micro-templating/
// Simple JavaScript Templating
// John Resig - http://ejohn.org/ - MIT Licensed
;(function(){
  var cache = {};

  function handleURLEncodedScriptlets(str) {
    var re = /%7B(?:%25|%)=.+?(?:%25|%)%7D/ig;
    var match;
    var res = [];
    var lastIndex = 0;
    var prematch;
    while ((match = re.exec(str))) {
      prematch = str.substring(lastIndex, match.index);
      if (prematch.length)
        res.push(prematch);
      // firefox can be a bit wrong here, forgetting to escape single '%'
      var matchStr = match[0].replace('%=', '%25=').replace('%%7D', '%25%7D');
      res.push(decodeURIComponent(matchStr));
      lastIndex = re.lastIndex;
    }

    // fastpath
    if (!lastIndex)
      return str;

    prematch = str.substring(lastIndex);
    if (prematch.length)
      res.push(prematch);

    return res.join('');
  }

  this.tmpl = function tmpl(str, data){
    // Figure out if we're getting a template, or if we need to
    // load the template - and be sure to cache the result.

    var fn = !/\W/.test(str) && (cache[str] = cache[str] ||
                                 tmpl(document.getElementById(str).innerHTML));

    if (!fn) {
      str = handleURLEncodedScriptlets(str);
      // Generate a reusable function that will serve as a template
      // generator (and which will be cached).
      fn = _.template(str);
    }

    // Provide some basic currying to the user
    return data ? fn( data ) : fn;
  };
})();

var SpinnerHTML = "<div class='spinner'><span>Loading...</span></div>";

function prepareAreaUpdate(jq) {
  if (_.isString(jq))
    jq = $(jq);
  var height = jq.height();
  var width = jq.width();
  if (height < 50)
    height = 50;
  if (width < 100)
    width = 100;
  var replacement = $(SpinnerHTML, document);
  replacement.css('width', width + 'px').css('height', height + 'px').css('lineHeight', height + 'px');
  jq.html("");
  jq.append(replacement);
}

function getRealBackgroundColor(jq) {
  while (jq.get(0) != document) {
    if (!jq.length)
      return 'transparent';
    var rv = jq.css('background-color');
    if (rv != 'transparent' && rv != 'inherit' && rv != 'rgba(0, 0, 0, 0)')
      return rv;
    jq = jq.parent();
  }
}

function overlayWithSpinner(jq, backgroundColor) {
  if (_.isString(jq))
    jq = $(jq);
  var height = jq.height();
  var width = jq.width();
  var html = $(SpinnerHTML, document);
  var pos = jq.position();
  var newStyle = {
    width: width+'px',
    height: height+'px',
    lineHeight: height+'px',
    'margin-top': jq.css('margin-top'),
    'margin-bottom': jq.css('margin-bottom'),
    'margin-left': jq.css('margin-left'),
    'margin-right': jq.css('margin-right'),
    'padding-top': jq.css('padding-top'),
    'padding-bottom': jq.css('padding-bottom'),
    'padding-left': jq.css('padding-left'),
    'padding-right': jq.css('padding-right'),
    'border-width-top': jq.css('border-width-top'),
    'border-width-bottom': jq.css('border-width-bottom'),
    'border-width-left': jq.css('border-width-left'),
    'border-width-right': jq.css('border-width-right'),
    position: 'absolute',
    'z-index': '9999',
    top: pos.top + 'px',
    left: pos.left + 'px'
  }
  if (jq.css('position') == 'fixed') {
    newStyle.position = 'fixed';
    var offsetParent = jq.offsetParent().get(0);
    newStyle.top = (parseFloat(newStyle.top) - offsetParent.scrollTop - offsetParent.parentNode.scrollTop) + 'px';
    newStyle.left = (parseFloat(newStyle.left) - offsetParent.scrollLeft - offsetParent.parentNode.scrollLeft) + 'px';
  }
  if (backgroundColor !== false) {
    var realBackgroundColor = backgroundColor || getRealBackgroundColor(jq);
    newStyle['background-color'] = realBackgroundColor;
  }
  _.each(newStyle, function (value, key) {
    html.css(key, value);
  })
  jq.after(html);

  return {
    remove: function () {
      html.remove();
    }
  };
}

function prepareRenderTemplate() {
  $.each($.makeArray(arguments), function () {
    prepareAreaUpdate('#'+ this + '_container');
  });
}

var ViewHelpers = {};
var AfterTemplateHooks;

function renderRawTemplate(toElement, templateID, data) {
  if ($.isArray(data)) {
    data = {rows:data};
  }

  var oldHooks = AfterTemplateHooks;
  AfterTemplateHooks = [];
  try {
    var fn = tmpl(templateID);
    var value = fn(data)
    toElement.innerHTML = value;

    _.each(AfterTemplateHooks, function (hook) {
      hook.call();
    });

    $(window).trigger('template:rendered');
  } finally {
    AfterTemplateHooks = oldHooks;
  }
}

function renderTemplate(key, data, to) {
  to = to || $i(key + '_container');
  var from = key + '_template';

  return renderRawTemplate(to, from, data);
}

function $m(self, method, klass) {
  if (klass) {
    var f = klass.prototype[method];
    if (!f || !f.apply)
      throw new Error("Bogus method: " + method + " on prototype of: " + klass);
  } else {
    var f = self[method];
    if (!f || !f.apply)
      throw new Error("Bogus method: " + method + " on object: " + self);
  }

  function rv () {
    return f.apply(self, arguments);
  }

  rv['$m'] = _.toArray(arguments);
  rv['$m.f'] = f;

  return rv;
}

function $i(id) {
  return document.getElementById(id);
}

// borrowed from MIT-licensed prototype.js http://www.prototypejs.org/
function functionArgumentNames(f) {
  var names = f.toString().match(/^[\s\(]*function[^(]*\(([^\)]*)\)/)[1]
                                 .replace(/\s+/g, '').split(',');
  return names.length == 1 && !names[0] ? [] : names;
};

function reloadApp(middleCallback) {
  prepareAreaUpdate($(document.body));
  if (middleCallback)
    middleCallback(reloader);
  else
    reloader();

  function reloader(where) {
    if (where) {
      if (where == window.location.href)
        window.location.reload();
      else
        window.location.href = where;
    } else
      window.location.href = "/";
  }
}

// reloads application keeping current URL
function reloadPage() {
  reloadApp(function (reloader) {
    reloader(window.location.href);
  });
}

function reloadAppWithDelay(millis) {
  millis = millis || 1500;
  reloadApp(function (reload) {
    _.delay(reload, millis);
  });
}

function mkReloadWithDelay(millis) {
  return function () {
    reloadAppWithDelay(millis);
  }
}

// this thing ensures that a back button pressed during some modal
// action (waiting http POST response, for example) will reload the
// page, so that we don't have to face issues caused by unexpected
// change of state
(function () {
  var modalLevel = 0;

  function ModalAction() {
    modalLevel++;
    this.finish = function () {
      modalLevel--;
      delete this.finish;
      if (!modalLevel)
        $(window).trigger('modal-action:complete');
    }
  }

  window.ModalAction = ModalAction;

  ModalAction.isActive = function () {
    return modalLevel;
  }

  ModalAction.getModalLevel = function () {
    return modalLevel;
  }

  ModalAction.leavingNow = function () {
    if (modalLevel) {
      reloadApp();
    }
  }

  $(function () {
    // first event is skipped, 'cause it's manually triggered by us
    var hadFirstEvent = false;
    $(window).bind('hashchange', function () {
      if (hadFirstEvent)
        ModalAction.leavingNow();
      else
        hadFirstEvent = true;
    })
  });
})();

function isBlank(e) {
  return e == null || !e.length;
}

(function () {
  var plannedState;
  var timeoutId;

  function planPushState(state) {
    plannedState = state;
    if (!timeoutId) {
      timeoutId = setTimeout(function () {
        $.bbq.pushState(plannedState, 2);
        plannedState = undefined;
        timeoutId = undefined;
      }, 100);
    }
    $(window).trigger('hashchange');
  }
  function setHashFragmentParam(name, value) {
    var state = _.extend({}, plannedState || $.bbq.getState());
    if (value == null) {
      if (!(name in state))
        return;
      delete state[name];
      planPushState(state);
    } else if (value != state[name]) {
      if (state[name] == value)
        return;
      state[name] = value;
      planPushState(state);
    }
  }

  function getHashFragmentParam(name) {
    return (plannedState && plannedState[name]) || $.bbq.getState(name);
  }

  window.setHashFragmentParam = setHashFragmentParam;
  window.getHashFragmentParam = getHashFragmentParam;
})();

function watchHashParamChange(param, defaultValue, callback) {
  if (!callback) {
    callback = defaultValue;
    defaultValue = undefined;
  }

  var oldValue;
  var firstTime = true;
  $(function () {
    $(window).bind('hashchange', function () {
      var newValue = getHashFragmentParam(param) || defaultValue;
      if (!firstTime && oldValue == newValue)
        return;
      firstTime = false;
      oldValue = newValue;
      return callback.apply(this, [newValue].concat($.makeArray(arguments)));
    });
  });
}

function showDialog(idOrJQ, options) {
  var jq = _.isString(idOrJQ) ? $($i(idOrJQ)) : idOrJQ;
  var w = jq.dialog('widget').hasClass('ui-dialog') ? jq.dialog('widget').width() : jq.width();
  options = _.extend({width: w}, options || {});
  var onHashChange;

  $(window).bind('hashchange', onHashChange = function () {
    hideDialog(jq);
  });

  var eventBindings = options.eventBindings || [];

  function onHide() {
    $(window).unbind('hashchange', onHashChange);

    // unbind events that we bound
    iterateBindings(function (e, eventType, callback) {
      e.unbind(eventType, callback);
    });

    // prevent closing if modal action is in progress
    if (ModalAction.isActive()) {
      // and now when cleanup is done, we can re-activate dialog
      return showDialog(idOrJQ, options);
    }

    if (options.onHide) {
      options.onHide(idOrJQ);
    }
  }

  options = _.extend({modal: true, close: onHide, resizable: false,
    draggable: false}, options);

  jq.dialog(options);

  if (jq.height() > $(window).height()) {
    jq.dialog('widget').css({'position': 'absolute', 'top':'15px'});
    $('html, body').animate({scrollTop: jq.dialog('widget').offset().top}, 250);
  }

  jq.find('.close').click(function(ev) {
    ev.preventDefault();
    jq.dialog('close');
  });

  function iterateBindings(body) {
    _.each(eventBindings, function (arr) {
      var selector, eventType, callback;
      selector = arr[0];
      eventType = arr[1];
      callback = arr[2];

      var found = jq.find(selector);
      body(found, eventType, callback);
    });
  }

  iterateBindings(function (e, eventType, callback) {
    e.bind(eventType, callback);
  });
}

function showDialogHijackingSave(dialogID, saveCSS, onSave) {
  showDialog(dialogID, {
    eventBindings: [[saveCSS, 'click', function (e) {
      e.preventDefault();
      hideDialog(dialogID);
      onSave.call(this, e);
    }]]
  });
}

function hideDialog(id) {
  if (_.isString(id))
    id = $($i(id));
  id.dialog('close');
  ModalAction.leavingNow();
}

function extractFunctionName(f, anonLimit) {
  anonLimit = anonLimit || 256;
  var text = new String(f);
  var match = text.match(/^[\s\(]*function\s+([^(]*)\(/);
  if (!match) {
    return "<unknown>";
  }
  var name = match[1];
  if (name)
    return name;
  // use function source as name for short anonymous functions
  if (text.length < anonLimit)
    return "(" + text + ")";
  return "<anonymous>"
}

// uses some legacy magic (arguments.callee) to build current backtrace
// doesn't work on non-legacy JS implementations (all except mozilla and ie)
// and doesn't support recursive functions
function collectBacktraceViaCaller() {
  function jsonify(a, limit) {
    try {
      if (window.JSON) { //IE8, FF & recent Webkit
        return JSON.stringify(a);
      }

      if (limit <= 0)
        return '<...>';
      limit--;

      if (_.isString(a)) {
        return "'" + escapeJS(a) + "'";
      } else if (_.isNumber(a)) {
        return String(a);
      } else if (_.isArray(a)) {
        return "[" + _.map(a, function (e) {return jsonify(e, limit)}) + "]"
      } else if (a instanceof Function) {
        return "<function " + extractFunctionName(a, 16) + ">";
      } else if (a instanceof Object) {
        var rv = _.map(a, function (val, key) {
          if (Object.prototype.hasOwnProperty.call(a, key)) {
            return jsonify(key, limit) + ':' + jsonify(val, limit)
          }
        });
        return '{' + _.without(rv, undefined).join(',') + '}';
      }

      return "<other '" + String(a).slice(0, 64) + "'>"
    } catch (e) {
      return "<failed>";
    }
  }

  var depthLimit = 64;
  var argsJSONDepthLimit = 4;
  var current = collectBacktraceViaCaller;

  var rv = [];

  for (; current && depthLimit > 0; depthLimit--, current = current.caller) {
    var fname = extractFunctionName(current);

    var args = _.toArray(current.arguments);
    args = _.map(args, function (a) {
      return jsonify(a, argsJSONDepthLimit)
    });

    rv.push("Function: ", fname, "\n");
    rv.push("Args:\n");
    rv.push(args.join("\n"));
    rv.push("\n---------\n");
  }
  if (current) {
    rv.push("<depth limit reached>\n");
  }
  return rv.join('');
}

var Abortarium = {
  recentlyAborted: [],
  MAX_LENGTH: 50,
  abortRequest: function (xhr) {
    if (this.isAborted(xhr))
      return;
    console.log("aborting request:", xhr);
    this.recentlyAborted.push(xhr);
    if (this.recentlyAborted.length > this.MAX_LENGTH)
      this.recentlyAborted = this.recentlyAborted.slice(-this.MAX_LENGTH);
    try {
      return xhr.abort();
    } finally {
      try {xhr.onreadystatechange = $.noop();} catch (e) {}
    }
  },
  isAborted: function (xhr) {
    return _.include(this.recentlyAborted, xhr);
  },
  wrapSuccessCallback: function (callback) {
    if (!callback)
      return callback;
    return function (data, status, xhr) {
      if (Abortarium.isAborted(xhr))
        return;
      return callback.apply(this, arguments);
    }
  }
};

function serializeForm(f) {
  f = $(f);
  var array = f.serializeArray();
  var seenKeys = {};
  array = _.filter(array, function (pair) {
    if (seenKeys[pair.name])
      return false;
    seenKeys[pair.name] = true;
    return true;
  });

  return $.param(array);
}

// this is how built-in sort compares arguments. I was shocked to see
// that numbers are sorted as strings!
function defaultComparator(a, b) {
  a = String(a);
  b = String(b);
  if (a < b)
    return -1;
  if (a > b)
    return 1;
  return 0;
}

function mkComparatorByProp(propName, propComparator) {
  propComparator = propComparator || defaultComparator;
  return function (a,b) {
    return propComparator(a[propName], b[propName]);
  }
}

function calculatePercent(value, total) {
  return (value * 100 / total) >> 0;
}

function parseValidateInteger(number, min, max) {
  number = String(number);

  if (!(/^-?[0-9]+$/.exec(number)))
    return "need integer";

  number = parseInt(number, 10);
  if (number < min) {
    return "too small";
  }
  if (number > max) {
    return "too large";
  }

  return number;
}

var basedigits = "0123456789ABCDEF";
function integerToString(number, base) {
  var rv = [];
  var sign = '';
  if (number < 0) {
    sign = '-';
    number = -number;
  }
  do {
    var r = number % base;
    number = (number / base) >> 0;
    rv.push(basedigits.charAt(r));
  } while (number != 0);
  rv.push(sign);
  rv.reverse();
  return rv.join('');
}

// Does simple down sampling of samples by a factor of decimation.  To
// avoid sampling artifacts we actually filter our samples to cut
// frequencies higher than new sampling frequency. The filter we use
// is very simple first-order filter as described here:
// http://en.wikipedia.org/wiki/Low-pass_filter
//
// Implementing something more fancy (higher-order) is possible in
// future.
function decimateSamples(decimation, samples) {
  // the math is as follows:
  // α = δt / (RC + δt)
  // Assuming ω = 2π and δt = 1 (original samples freq. is 1hz)
  // RC = 1/ω₀ where ω₀ is angular speed of cut-off freq
  // ω₀ = ω d where d is decimation factor
  // RC = 1/(ω d)
  //            1                 ω d            2πd
  // α = ————————————————— = —————————————— = —————————
  //      1/(ω d) + 1          1 + ω d         1 + 2πd
  var two_pi_d = 2 * Math.PI * decimation;
  var alpha = two_pi_d / (1 + two_pi_d);
  var beta = 1 - alpha;

  var filteredSamples = new Array(samples.length);
  var i;
  filteredSamples[0] = samples[0];
  for (i = 1; i < samples.length; i++)
    filteredSamples[i] = samples[i] * alpha + filteredSamples[i-1] * beta;

  // now we just decimate
  return decimateNoFilter(decimation, filteredSamples);
}

function decimateNoFilter(decimation, samples) {
  var outputSamples = new Array((samples.length / decimation) >> 0);
  // we want last filtered sample to be held, not first
  var j = samples.length-1;
  for (i = outputSamples.length-1; i >= 0; i--, j -= decimation)
    outputSamples[i] = samples[j];

  return outputSamples;
}

Math.Ki = 1024;
Math.Mi = 1048576;
Math.Gi = 1073741824;

// this parses date from formats defined in HTTP 1.1 (rfc2616)
(function () {
  var rfc1123RE = /^\s*[a-zA-Z]+, ([0-9][0-9]) ([a-zA-Z]+) ([0-9]{4,4}) ([0-9]{2,2}):([0-9]{2,2}):([0-9]{2,2}) GMT\s*$/m;
  var rfc850RE = /^\s*[a-zA-Z]+, ([0-9][0-9])-([a-zA-Z]+)-([0-9]{2,2}) ([0-9]{2,2}):([0-9]{2,2}):([0-9]{2,2}) GMT\s*$/m;
  var asctimeRE = /^\s*[a-zA-Z]+ ([a-zA-Z]+) ((?:[0-9]| )[0-9]) ([0-9]{2,2}):([0-9]{2,2}):([0-9]{2,2}) ([0-9]{4,4})\s*$/m;

  var monthDict = {};

  (function () {
    var monthNames = ["January", "February", "March", "April", "May", "June",
                      "July", "August", "September", "October", "November", "December"];

    for (var i = monthNames.length-1; i >= 0; i--) {
      var name = monthNames[i];
      var shortName = name.substring(0, 3);
      monthDict[name] = i;
      monthDict[shortName] = i;
    }
  })();

  var badDateException;
  (function () {
    try {
      throw {};
    } catch (e) {
      badDateException = e;
    }
  })();

  function parseMonth(month) {
    var number = monthDict[month];
    if (number === undefined)
      throw badDateException;
    return number;
  }

  function doParseHTTPDate(date) {
    var match;
    if ((match = rfc1123RE.exec(date)) || (match = rfc850RE.exec(date))) {
      var day = parseInt(match[1], 10);
      var month = parseMonth(match[2]);
      var year = parseInt(match[3], 10);

      var hour = parseInt(match[4], 10);
      var minute = parseInt(match[5], 10);
      var second = parseInt(match[6], 10);

      return new Date(Date.UTC(year, month, day, hour, minute, second));
    } else if ((match = asctimeRE.exec(date))) {
      var month = parseMonth(match[1]);
      var day = parseInt(match[2], 10);

      var hour = parseInt(match[3], 10);
      var minute = parseInt(match[4], 10);
      var second = parseInt(match[5], 10);

      var year = parseInt(match[6], 10);

      return new Date(Date.UTC(year, month, day, hour, minute, second));
    } else {
      throw badDateException;
    }
  }

  function parseHTTPDate(date, badDate) {
    try {
      return doParseHTTPDate(date);
    } catch (e) {
      if (e === badDateException) {
        console.log("Cannot parse http date!!!: ", date);
        return badDate || (new Date());
      }
      throw e;
    }
  }

  this.parseHTTPDate = parseHTTPDate;
})();

(function($){
  $.fn.need = function (howmany) {
    var $this = $(this);
    if ($this.length != howmany) {
      console.log("Expected jquery of length ", howmany, ", got: ", $this);
      throw new Error("Expected jquery of length " + howmany + ", got " + $this.length);
    }
    return $this;
  };
})(jQuery);

function mkTokenBucket(rate, burst, initial) {
  var available = (initial !== undefined) ? initial : burst;
  var whenAvailable = (new Date()).valueOf();
  return function () {
    var now = (new Date()).valueOf();
    var seconds = Math.floor((now - whenAvailable) / 1000);
    if (seconds > 0) {
      available = Math.min(burst, available + seconds * rate);
      whenAvailable += seconds * 1000;
    }
    if (!available)
      return false;
    available--;
    return true;
  }
}