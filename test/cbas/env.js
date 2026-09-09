/*
Copyright 2026-Present Couchbase, Inc.

Use of this software is governed by the Business Source License included in
the file licenses/BSL-Couchbase.txt.  As of the Change Date specified in that
file, in accordance with the Business Source License, use of this software will
be governed by the Apache License, Version 2.0, included in the file
licenses/APL2.txt.
*/

// Builds a real AngularJS injector around the real cbas-ui modules.
//
// Everything under test is the shipped source, loaded through the product's own
// importmap and module loader. Only the boundary is stubbed: $http, the
// ns_server services (mnPools, mnPoolDefault, ...) and the query-ui services
// (qw*), none of which this UI owns, plus $uibModal, which is how a dialog
// reports OK and the only thing standing between a test and a rendered modal.

import angular from "angular";

// Registers the 'cwQueryService' angular module. Imported for that side effect.
import "/_p/ui/cbas/cw_query_service.js";
import cbasController from "/_p/ui/cbas/cw_cbas_controller.js";

// A $q-backed $http, answered by the handler a test installs with onHttp().
// The default answers every call with an empty body, which is all this
// controller's start-up polling wants.
function makeHttp($q, state) {
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

export function makeEnv() {
  var state = {handler: function () { return undefined; }};

  // A fresh module each time: $provide.value registrations are global to the
  // module, and a test that installs its own stub must not leak into the next.
  var moduleName = 'cbasTestEnv' + (makeEnv.counter = (makeEnv.counter || 0) + 1);
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

  var injector = angular.injector(['ng', 'cwQueryService', moduleName]);
  var $rootScope = injector.get('$rootScope');
  var $q = injector.get('$q');
  var cwQueryService = injector.get('cwQueryService');

  // Captures the scope and template each dialog opened with, and lets a test
  // press OK: the iceberg dialog builds its statement in the modal's result
  // handler, so that is the only way to reach it.
  var modal = {
    opened: [],
    last: function () { return modal.opened[modal.opened.length - 1]; },
    scope: function () { return modal.last().scope; },
    ok: function (value) {
      modal.last().deferred.resolve(value === undefined ? 'ok' : value);
      $rootScope.$digest();
    }
  };
  var $uibModal = {
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

  // Statements the UI would have sent to the server. Every DDL path in this
  // controller funnels through executeQueryUtil, so overriding it here is both
  // the assertion point and what keeps the test off the network.
  var statements = [];
  cwQueryService.executeQueryUtil = function (query) {
    statements.push(query);
    return $q.resolve({data: {}});
  };

  var env = {
    $q: $q,
    cwQueryService: cwQueryService,
    cwConstantsService: injector.get('cwConstantsService'),
    modal: modal,
    statements: statements,
    onHttp: function (handler) { state.handler = handler; },
    digest: function () { $rootScope.$digest(); },
    lastStatement: function () { return statements[statements.length - 1]; }
  };

  // Only the services the injector cannot supply are passed as locals; the rest
  // - cwQueryService, cwConstantsService, $timeout and friends - are the real
  // ones, resolved from the modules above.
  env.controller = injector.instantiate(cbasController, {
    $scope: $rootScope.$new(),
    $stateParams: {},
    $uibModal: $uibModal,
    mnAlertsService: {formatAndSetAlerts: function () {}},
    mnServersService: {getNodes: function () { return $q.resolve({}); }},
    qwJsonCsvService: {},
    qwCollectionsService: {getBuckets: function () { return $q.resolve([]); }}
  });

  // Renders the template a dialog opened with, against that dialog's scope, so
  // an assertion can ask what the user would actually see. The wiring between
  // an ng-if and the scope function behind it is invisible to any other layer:
  // a misspelled expression is simply always false, and the option never shows.
  env.render = function () {
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

  // The controller starts fetching the moment it is constructed, and those
  // promises land on the first digest - clearing the metadata arrays as they
  // go. Settling them here means a test seeds its data into a quiet service
  // instead of watching start-up wipe it.
  $rootScope.$digest();

  return env;
}
