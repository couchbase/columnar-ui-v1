/*
Copyright 2017-Present Couchbase, Inc.

Use of this software is governed by the Business Source License included in
the file licenses/BSL-Couchbase.txt.  As of the Change Date specified in that
file, in accordance with the Business Source License, use of this software will
be governed by the Apache License, Version 2.0, included in the file
licenses/APL2.txt.
*/

import angular from 'angular';
import _ from 'lodash';
import uiBootstrap from 'angular-ui-bootstrap';

import mnAuthService from '../mn_auth/mn_auth_service.js';
import mnPoolDefault from './mn_pool_default.js';

export default 'mnSessionService';

angular
  .module('mnSessionService', [mnAuthService, mnPoolDefault, uiBootstrap])
  .factory('mnSessionService', mnSessionFactory);

function mnSessionFactory($http, $window, $timeout, mnAuthService, $interval, mnPoolDefault, $uibModal) {
  var mnSession = {
    post: post,
    get: get,
    init: init,
    setTimeout: setTimeout,
    resetTimeoutAndSyncAcrossTabs: resetTimeoutAndSyncAcrossTabs,
    showTimeoutDialog: showTimeoutDialog
  };
  var throttledResetTimeoutAndSyncAcrossTabs = _.throttle(resetTimeoutAndSyncAcrossTabs, 300);
  var sessionTimer;
  var sessionTimeoutDialog;
  var showTimeoutDialogTimer;

  return mnSession;

  function init($scope) {
    angular.element($window).on("storage", doSyncAcrossTabs);
    angular.element($window).on("mousemove keydown touchstart",
                                throttledResetTimeoutAndSyncAcrossTabs);

    $scope.$on("$destroy", function () {
      angular.element($window).off("mousemove keydown touchstart",
                                   throttledResetTimeoutAndSyncAcrossTabs);
      angular.element($window).off("storage", doSyncAcrossTabs);
    });
  }

  function post(uiSessionTimeout) {
    return $http({
      method: "POST",
      url: "/settings/security",
      data: {
        uiSessionTimeout: uiSessionTimeout ? (uiSessionTimeout * 60) : undefined
      }
    });
  }

  function get() {
    return mnPoolDefault.get().then(function (resp) {
      return {
        uiSessionTimeout: (Number(resp.uiSessionTimeout) / 60) || 0
      };
    });
  }

  function showTimeoutDialog(timeout) {
    return function () {
      sessionTimeoutDialog = $uibModal.open({
        controller: function ($scope) {
          var timer = $interval(function () {
            --$scope.time;
          }, 1000);
          $scope.time = (timeout / 1000);
          $scope.$on("$destroy", function () {
            $interval.cancel(timer);
          });
        },
        templateUrl: 'app/mn_admin/mn_session_timeout_dialog.html'
      });

      sessionTimeoutDialog.result.then(function () {
        sessionTimeoutDialog = null;
        resetTimeoutAndSyncAcrossTabs(); //closed by user
      }, function (closedBy) {
        sessionTimeoutDialog = null;
        if (!closedBy) {
          resetTimeoutAndSyncAcrossTabs(); //dismissed by user
        }
      });
    }
  }

  function resetTimeout(timeout) {
    timeout = Number(timeout);
    var dialogTimeout;
    if (sessionTimer) {
      $timeout.cancel(sessionTimer);
    }
    if (showTimeoutDialogTimer) {
      $timeout.cancel(showTimeoutDialogTimer);
    }
    if (timeout) {
      dialogTimeout = timeout - 30000;
      sessionTimer = $timeout(mnAuthService.logout.bind(mnAuthService), timeout);
      showTimeoutDialogTimer = $timeout(showTimeoutDialog(dialogTimeout), dialogTimeout);
    }
  }

  function setTimeout(uiSessionTimeout) {
    localStorage.setItem("uiSessionTimeout", Number(uiSessionTimeout) * 1000);
  }

  function resetTimeoutAndSyncAcrossTabs() {
    if (sessionTimeoutDialog) {
      return;
    }
    resetTimeout(localStorage.getItem("uiSessionTimeout"));
    localStorage.setItem("mnResetSessionTimeout",
                         Number(localStorage.getItem("mnResetSessionTimeout") || "0") + 1);
  }

  function doSyncAcrossTabs(e) {
    if (e.key === "mnResetSessionTimeout") {
      if (sessionTimeoutDialog) {
        sessionTimeoutDialog.dismiss("reset");
      }
      resetTimeout(localStorage.getItem("uiSessionTimeout"));
    }
  }
}
