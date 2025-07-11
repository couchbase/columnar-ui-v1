/*
Copyright 2020-Present Couchbase, Inc.

Use of this software is governed by the Business Source License included in
the file licenses/BSL-Couchbase.txt.  As of the Change Date specified in that
file, in accordance with the Business Source License, use of this software will
be governed by the Apache License, Version 2.0, included in the file
licenses/APL2.txt.
*/

import angular from "angular";

import mnPromiseHelper from "../components/mn_promise_helper.js";
import mnSettingsNotificationsService from "./mn_settings_notifications_service.js";
import mnSettingsClusterService from "./mn_settings_cluster_service.js"

export default "mnSettingsNotifications";

angular
  .module('mnSettingsNotifications', [
    mnPromiseHelper,
    mnSettingsNotificationsService,
    mnSettingsClusterService
  ])
  .controller('mnSettingsNotificationsController', ["mnPromiseHelper", "mnSettingsNotificationsService", "pools", "mnPoolDefault", "mnSettingsClusterService", mnSettingsNotificationsController]);

function mnSettingsNotificationsController(mnPromiseHelper, mnSettingsNotificationsService, pools, mnPoolDefault, mnSettingsClusterService) {
  var vm = this;

  mnSettingsClusterService.registerSubmitCallback(submit);
  mnSettingsClusterService.registerInitChecker(() => (vm.updates != void 0));
  vm.implementationVersion = pools.implementationVersion;
  vm.isEnterprise = mnPoolDefault.export.isEnterprise;

  activate();

  function activate() {
    mnPromiseHelper(vm, mnSettingsNotificationsService.maybeCheckUpdates())
      .applyToScope("updates")
      .onSuccess(function() {
        if (vm.updates && vm.updates.links && !vm.updates.links.upgrade) {
          // Prefer newVersion, fallback to implementationVersion
          const versionSource = vm.updates.newVersion || vm.implementationVersion;
          let majorMinor = "latest";
          if (versionSource) {
            const match = versionSource.match(/(\d+\.\d+\.\d+(?:-[\w\d]+)?)$/);
            if (match) {
              const versionParts = match[1].split(".");
              majorMinor = versionParts[0] + "." + versionParts[1];
            }
          }
          vm.updates.links.upgrade =
              "https://docs.couchbase.com/enterprise-analytics/" +
              majorMinor +
              "/install/upgrade.html";
        }
      });
  }

  function submit() {
    return mnPromiseHelper(vm, mnSettingsNotificationsService.saveSendStatsFlag(vm.updates.enabled))
      .catchGlobalErrors('An error occurred, update notifications settings were not saved.')
      .getPromise();
  }
}
