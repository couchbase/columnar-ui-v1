/*
Copyright 2026-Present Couchbase, Inc.

Use of this software is governed by the Business Source License included in
the file licenses/BSL-Couchbase.txt.  As of the Change Date specified in that
file, in accordance with the Business Source License, use of this software will
be governed by the Apache License, Version 2.0, included in the file
licenses/APL2.txt.
*/

// The Security section's Service RBAC page, on a real injector.
//
// The injector here is deliberately bare: `ng`, the page's own modules, and a
// stubbed $http. Nothing from the workbench, and none of the query-ui services
// stubs.js provides for it.
//
// That is the point, and it is a regression test in its own right. This tab
// lives in the Security section and can be the first thing a user opens, so it
// must not need anything cbas.js registers - cbas.js is the workbench's lazily
// loaded module, and until the Workbench tab has been visited it has not run.
// cwQueryService is the trap: its factory injects qwQueryPlanService and
// qwDialogService, which its own module does not declare and cbas.js supplies.
// Depending on it renders a blank tab for anyone who opens Security first,
// while still passing any test that had stubbed those services. Anything this
// page reaches for that is not below fails DI here instead.
//
// The page's reads are SQL++ against Metadata.`Role`, Metadata.`Privilege`,
// Metadata.`AssignedRole` and the databases and scopes, plus ns_server's user
// list and /whoami, so a test seeds those and then drives the dialogs. Writes
// are whatever else reaches the query endpoint.
//
// Whether the viewer may change anything is two seeds: `canManage`, which is
// the platform permission ns_server publishes on the root scope, and `whoami`,
// which is who the assignment rows are matched against. `canManage` defaults
// to true because most cases are about administering, not about who may.
//
// `usersReadable: false` refuses the user list the way ns_server does for a
// viewer without cluster.admin.users!read - a seed rather than an onHttp
// handler, so a case can withhold that one endpoint and keep every other
// answer the env is seeding. The page then falls back to the engine's users()
// function, seeded separately as `engineUsers`; withhold both for a viewer
// entitled to neither. `serviceDown` refuses every query the way ns_server's
// proxy refuses one for an analytics node that is not running.

import angular from "angular";

// Registers the 'cwRbacService' angular module, and 'cwConstantsService' which
// it depends on. Imported for that side effect.
import "/_p/ui/cbas/cw_rbac_service.js";
import cwRbacController from "/_p/ui/cbas/cw_rbac_controller.js";
import cbasRbacTemplate from "/_p/ui/cbas/cbas_rbac.html";

import {makeHttp, makeModal, makeRender} from "./stubs.js";

var counter = 0;

// Answers a metadata read by which dataset it names. The page issues four
// reads that differ only in their FROM clause, and a test that had to match
// whole statements would break every time one is reworded.
function answerFor(statement, data) {
  if (statement.indexOf("Metadata.`Role`") >= 0) {
    return data.roles;
  }
  if (statement.indexOf("Metadata.`Privilege`") >= 0) {
    return data.privileges;
  }
  if (statement.indexOf("Metadata.`AssignedRole`") >= 0) {
    return data.assignments;
  }
  if (statement.indexOf("Metadata.`Dataverse`") >= 0) {
    return data.keyspaces;
  }
  return null;
}

export function makeRbacEnv(options) {
  options = options || {};

  // The keyspace read answers one row per database and one per scope, which is
  // what lets a database with no scopes still be a grant target.
  var keyspaces = (options.databases || []).map(function (name) {
    return {DatabaseName: name, DataverseName: null};
  }).concat((options.scopes || []).map(function (scope) {
    return {DatabaseName: scope.database, DataverseName: scope.scope};
  }));

  var data = {
    roles: options.roles || [],
    privileges: options.privileges || [],
    assignments: options.assignments || [],
    keyspaces: keyspaces,
    users: options.users || [],
    whoami: options.whoami || null,
    usersReadable: options.usersReadable === undefined ? true : !!options.usersReadable,
    // Defaults to the same answer the platform would have given, so a case that
    // only withholds the REST endpoint still gets a list - which is the shape
    // of a sys_security_admin with no platform role over users.
    engineUsers: options.engineUsers === undefined ? (options.users || []) : options.engineUsers,
    // ns_server's pluggable-UI proxy answers a missing analytics node with 404
    // and a plain-text body, or 503 when no compatible node can be found -
    // never with the query service's own errors array, which is what tells an
    // unreachable service apart from a refused statement. `serviceDown: 503`
    // picks the other status.
    serviceDown: options.serviceDown === true ? 404 : (options.serviceDown || 0),
    // What the purge endpoint answers with. `null` refuses it; a number is the
    // count of rows it reports having deleted, 0 being the case where they went
    // between the read and the click.
    purgeRemoved: options.purgeRemoved === undefined ? 1 : options.purgeRemoved
  };

  // Statements the UI would have sent. Reads are answered from the seeded
  // data; anything else reaching the query endpoint is a write, and is
  // recorded rather than answered.
  var statements = [];

  // The handler needs $q, which needs the injector, which needs the module the
  // handler is registered in - so it starts as the default and is replaced as
  // soon as $q exists, before anything has had a chance to call it.
  var state = {handler: function () { return undefined; }};

  // The grantee-scoped purge is a DELETE, not a statement, so it is recorded
  // separately from the DDL: a case asserts on the path, which is where the
  // account being purged is named.
  var deletes = [];

  var moduleName = 'cbasRbacTestEnv' + (counter += 1);
  angular.module(moduleName, [])
    .config(['$provide', function ($provide) {
      $provide.factory('$http', ['$q', function ($q) { return makeHttp($q, state); }]);
    }]);

  var injector = angular.injector(['ng', 'cwRbacService', moduleName]);
  var $rootScope = injector.get('$rootScope');
  var $q = injector.get('$q');
  var queryURL = injector.get('cwConstantsService').queryURL;

  // What mnPermissions publishes, under the name the nav's ng-show expressions
  // and the page itself read it by.
  $rootScope.rbac = {
    cluster: {
      analytics: {
        access: true,
        manage: options.canManage === undefined ? true : !!options.canManage
      }
    }
  };

  state.handler = function (config) {
    if (String(config.method).toUpperCase() === "DELETE") {
      deletes.push(config.url);
      return data.purgeRemoved === null
        ? $q.reject({status: 500, data: {errors: [{code: 24000, msg: "purge failed"}]}})
        : $q.resolve({data: {removed: data.purgeRemoved}});
    }
    if (data.serviceDown && config.url === queryURL) {
      return $q.reject({status: data.serviceDown,
                        data: "Service cbas not running on this node"});
    }
    // The user list is ns_server's REST endpoint, not a query, and is behind a
    // platform permission this page's own viewer need not hold.
    if (config.url === "/settings/rbac/users") {
      return data.usersReadable
        ? $q.resolve({data: {users: data.users}})
        : $q.reject({status: 403});
    }
    // So is the viewer's own identity. A case that seeds no viewer gets the
    // rejection an unauthenticated one would, which is the harder case: the
    // page has to fall back to the platform permission alone.
    if (config.url === "/whoami") {
      return data.whoami ? $q.resolve({data: data.whoami}) : $q.reject({status: 403});
    }
    if (config.url === queryURL) {
      var statement = config.data && config.data.statement;
      // The engine's own view of the cluster's users, which the page falls back
      // to when the platform refuses its list. Handled here rather than in
      // answerFor, which reads a null as "that was a write": engineUsers: null
      // has to mean refused, which is the viewer entitled to neither source.
      if (statement.indexOf("users()") >= 0) {
        return data.engineUsers
          ? $q.resolve({data: {results: data.engineUsers}})
          : $q.resolve({data: {errors: [{code: 20001, msg: "Insufficient permissions"}]}});
      }
      var results = answerFor(statement, data);
      if (results === null) {
        statements.push(statement);
        return $q.resolve({data: {}});
      }
      return $q.resolve({data: {results: results}});
    }
    return undefined;
  };

  var modal = makeModal($q, $rootScope);

  var env = {
    $q: $q,
    queryURL: queryURL,
    cwRbacService: injector.get('cwRbacService'),
    modal: modal,
    statements: statements,
    deletes: deletes,
    lastDelete: function () { return deletes[deletes.length - 1]; },
    onHttp: function (handler) { state.handler = handler; },
    digest: function () { $rootScope.$digest(); },
    lastStatement: function () { return statements[statements.length - 1]; }
  };

  env.controller = injector.instantiate(cwRbacController, {
    $scope: $rootScope.$new(),
    $uibModal: modal.$uibModal
  });

  env.render = makeRender(injector, $rootScope, modal);

  // The page itself, compiled against the controller under its real alias.
  // The dialogs can be reached from the controller directly, but the actions
  // that open them cannot: an ng-click naming a method the alias does not have
  // is silently inert, and the button simply never does anything.
  env.renderPage = function () {
    var scope = $rootScope.$new();
    scope.rbacCtl = env.controller;
    var element = angular.element('<div></div>');
    element.html(cbasRbacTemplate);
    document.body.appendChild(element[0]);
    injector.get('$compile')(element)(scope);
    $rootScope.$digest();
    return element[0];
  };

  // The controller reads on construction; settle those before a test looks.
  $rootScope.$digest();

  return env;
}
