/*
Copyright 2026-Present Couchbase, Inc.

Use of this software is governed by the Business Source License included in
the file licenses/BSL-Couchbase.txt.  As of the Change Date specified in that
file, in accordance with the Business Source License, use of this software will
be governed by the Apache License, Version 2.0, included in the file
licenses/APL2.txt.
*/

// The boundary the cbas-ui modules sit behind, stubbed once.
//
// Everything under test is the shipped source; only what it does not own is
// replaced - $http, the ns_server services and the query-ui services, none of
// which cbas-ui vendors, plus $uibModal, which is how a dialog reports OK and
// the only thing standing between a test and a rendered modal.
//
// Both environments (the workbench in env.js, the RBAC page in rbac_env.js)
// need the same set, because both reach cwQueryService and it is what pulls the
// ns_server services in.

import angular from "angular";

// A $q-backed $http, answered by the handler a test installs with onHttp().
// The default answers every call with an empty body, which is all the
// controllers' start-up polling wants.
export function makeHttp($q, state) {
  function http(config) {
    var answer = state.handler(config);
    return answer === undefined ? $q.resolve({data: []}) : answer;
  }
  ['get', 'post', 'put', 'delete', 'head', 'patch'].forEach(function (method) {
    http[method] = function (url, data) {
      return http({method: method.toUpperCase(), url: url, data: data});
    };
  });
  return http;
}

// A fresh module each time: $provide.value registrations are global to the
// module, and a test that installs its own stub must not leak into the next.
var counter = 0;

export function stubModule(state) {
  var moduleName = 'cbasTestStubs' + (counter += 1);

  angular.module(moduleName, [])
    .config(['$provide', function ($provide) {
      $provide.factory('$http', ['$q', function ($q) { return makeHttp($q, state); }]);

      $provide.factory('mnPools', ['$q', function ($q) {
        return {
          get: function () { return $q.resolve({isEnterprise: true, isDeveloperPreview: false}); },
          export: {isEnterprise: true, isDeveloperPreview: false}
        };
      }]);

      $provide.value('mnPoolDefault', {
        export: {
          compat: {atLeast70: true, atLeast71: true, atLeast72: true},
          thisNode: {prodCompatVersion: '8.0.0'},
          isEnterprise: true
        },
        latestValue: function () { return {value: {nodes: []}}; },
        getUrlsRunningService: function () { return []; }
      });

      $provide.value('mnPendingQueryKeeper', {
        getQueryInFly: function () { return null; },
        removeQueryInFly: function () {},
        attachPendingQueryKeeper: function () {}
      });

      $provide.value('qwQueryPlanService', {analyzePlan: function () { return {}; }});
      $provide.value('qwDialogService', {showErrorDialog: function () {}});
    }]);

  return moduleName;
}

// Captures the scope and template each dialog opened with, and lets a test
// press OK: a dialog builds its statement in the modal's result handler, so
// that is the only way to reach it.
export function makeModal($q, $rootScope) {
  var modal = {
    opened: [],
    last: function () { return modal.opened[modal.opened.length - 1]; },
    scope: function () { return modal.last().scope; },
    ok: function (value) {
      modal.last().deferred.resolve(value === undefined ? 'ok' : value);
      $rootScope.$digest();
    },
    cancel: function () {
      modal.last().deferred.reject('cancel');
      $rootScope.$digest();
    }
  };

  modal.$uibModal = {
    open: function (config) {
      var deferred = $q.defer();
      modal.opened.push({scope: config.scope, template: config.template, deferred: deferred});
      return {
        result: deferred.promise,
        close: function () {},
        dismiss: function () {}
      };
    }
  };

  return modal;
}

// Renders the template a dialog opened with, against that dialog's scope, so an
// assertion can ask what the user would actually see. The wiring between an
// ng-if and the scope function behind it is invisible to any other layer: a
// misspelled expression is simply always false, and the option never shows.
export function makeRender(injector, $rootScope, modal) {
  return function render() {
    var opened = modal.last();
    var element = angular.element('<div></div>');
    element.html(opened.template);
    // Attached, not detached: a click on a checkbox outside the document does
    // not run its activation behaviour, so ng-model would never see it.
    document.body.appendChild(element[0]);
    injector.get('$compile')(element)(opened.scope);
    $rootScope.$digest();
    return element[0];
  };
}
