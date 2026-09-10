/*
Copyright 2026-Present Couchbase, Inc.

Use of this software is governed by the Business Source License included in
the file licenses/BSL-Couchbase.txt.  As of the Change Date specified in that
file, in accordance with the Business Source License, use of this software will
be governed by the Apache License, Version 2.0, included in the file
licenses/APL2.txt.
*/

// The Users & Groups page's service, on a real injector.
//
// Unlike the other two environments this one is over this repo's own source,
// not cbas-ui's: the service roles shown on that page are read from the
// analytics service with a query, and what that query asks for and how its
// answer is keyed are decisions with no other layer to catch them.

import angular from "angular";

// This repo's services reach further than cbas-ui's: mnUserRolesService pulls
// mnPoolDefault, which pulls mnHelper, which injects $state. UI-Router
// configures itself, so including it is enough.
import uiRouter from "@uirouter/angularjs";

// mnUserRolesService pulls mnStatisticsNewService, which injects mnPermissions
// while its file imports mn_pool_default.js under that name - so the module is
// never actually declared, and it only resolves in the product because the app
// registers it elsewhere. Named here so this injector does not depend on that.
import mnPermissions from "/ui/app/components/mn_permissions.js";

// Registers the 'mnUserRolesService' angular module. Imported for that side
// effect.
import "/ui/app/mn_admin/mn_user_roles_service.js";

import {makeHttp} from "./stubs.js";

var counter = 0;

export const ANALYTICS_QUERY_URL = "/_p/cbas/api/v1/request";

export function makeUsersEnv() {
  var requests = [];
  var state = {handler: function () { return undefined; }};

  var moduleName = 'mnUsersTestEnv' + (counter += 1);
  angular.module(moduleName, [])
    .config(['$provide', function ($provide) {
      // angular.injector() does not bootstrap, so nothing has provided the
      // element UI-Router's $location wants.
      $provide.value('$rootElement', angular.element(document.createElement('div')));

      $provide.factory('$http', ['$q', function ($q) {
        var http = makeHttp($q, state);
        return function (config) {
          requests.push(config);
          return http(config);
        };
      }]);
    }]);

  var injector = angular.injector(['ng', uiRouter, mnPermissions, 'mnUserRolesService', moduleName]);
  var $rootScope = injector.get('$rootScope');
  var $q = injector.get('$q');

  return {
    $q: $q,
    requests: requests,
    service: injector.get('mnUserRolesService'),
    onHttp: function (handler) { state.handler = handler; },
    digest: function () { $rootScope.$digest(); },
    // The service's answers arrive on a digest, so a test asks for the
    // settled value rather than a promise.
    settle: function (promise) {
      var settled = {};
      promise.then(function (value) { settled.value = value; },
                   function (error) { settled.error = error; });
      $rootScope.$digest();
      return settled;
    }
  };
}
