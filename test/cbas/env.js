/*
Copyright 2026-Present Couchbase, Inc.

Use of this software is governed by the Business Source License included in
the file licenses/BSL-Couchbase.txt.  As of the Change Date specified in that
file, in accordance with the Business Source License, use of this software will
be governed by the Apache License, Version 2.0, included in the file
licenses/APL2.txt.
*/

// Builds a real AngularJS injector around the real cbas-ui workbench modules.
//
// Everything under test is the shipped source, loaded through the product's own
// importmap and module loader. The boundary is stubbed in stubs.js, which
// rbac_env.js shares.

import angular from "angular";

// Registers the 'cwQueryService' angular module. Imported for that side effect.
import "/_p/ui/cbas/cw_query_service.js";
import cbasController from "/_p/ui/cbas/cw_cbas_controller.js";

import {stubModule, makeModal, makeRender} from "./stubs.js";

export function makeEnv() {
  var state = {handler: function () { return undefined; }};
  var moduleName = stubModule(state);

  var injector = angular.injector(['ng', 'cwQueryService', moduleName]);
  var $rootScope = injector.get('$rootScope');
  var $q = injector.get('$q');
  var cwQueryService = injector.get('cwQueryService');

  var modal = makeModal($q, $rootScope);

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
    $uibModal: modal.$uibModal,
    mnAlertsService: {formatAndSetAlerts: function () {}},
    mnServersService: {getNodes: function () { return $q.resolve({}); }},
    qwJsonCsvService: {},
    qwCollectionsService: {getBuckets: function () { return $q.resolve([]); }}
  });

  env.render = makeRender(injector, $rootScope, modal);

  // The controller starts fetching the moment it is constructed, and those
  // promises land on the first digest - clearing the metadata arrays as they
  // go. Settling them here means a test seeds its data into a quiet service
  // instead of watching start-up wipe it.
  $rootScope.$digest();

  return env;
}
