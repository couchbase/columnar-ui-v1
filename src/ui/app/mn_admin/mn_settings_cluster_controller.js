/*
Copyright 2020-Present Couchbase, Inc.

Use of this software is governed by the Business Source License included in
the file licenses/BSL-Couchbase.txt.  As of the Change Date specified in that
file, in accordance with the Business Source License, use of this software will
be governed by the Apache License, Version 2.0, included in the file
licenses/APL2.txt.
*/

import angular from "angular";
import _ from "lodash";

import mnHelper from "../components/mn_helper.js";
import mnSpinner from "../components/directives/mn_spinner.js";
import mnMainSpinner from "../components/directives/mn_main_spinner.js";
import mnField from "../components/directives/mn_field_directive.js";
import mnPromiseHelper from "../components/mn_promise_helper.js";
import mnMemoryQuota from "../components/directives/mn_memory_quota/mn_memory_quota.js";
import mnStorageMode from "../components/directives/mn_storage_mode/mn_storage_mode.js";

import mnPoolDefault from "../components/mn_pool_default.js";

import mnSettingsClusterService from "./mn_settings_cluster_service.js";
import mnXDCRService from "./mn_xdcr_service.js";
import mnMemoryQuotaService from "../components/directives/mn_memory_quota/mn_memory_quota_service.js";
import mnClusterConfigurationService from "../mn_wizard/mn_cluster_configuration/mn_cluster_configuration_service.js";
import template from "./mn_settings_cluster_confirmation_dialog.html";
import allXDCRLogLevelsTemplate from "./mn_settings_cluster_all_xdcr_log_levels_dialog.html";
import blobStorageErrorTemplate from "./mn_settings_cluster_blob_storage_error_dialog.html";

export default 'mnSettingsCluster';

angular.module('mnSettingsCluster', [
  mnHelper,
  mnSpinner,
  mnMainSpinner,
  mnField,
  mnPromiseHelper,
  mnMemoryQuota,
  mnStorageMode,
  mnPoolDefault,
  mnMemoryQuotaService,
  mnXDCRService,
  mnSettingsClusterService,
  mnClusterConfigurationService,
]).controller('mnSettingsClusterController', ["$scope", "$q", "$uibModal", "$ocLazyLoad", "mnPoolDefault", "mnMemoryQuotaService", "mnSettingsClusterService", "mnHelper", "mnPromiseHelper", "mnClusterConfigurationService", "mnXDCRService", mnSettingsClusterController]);

function mnSettingsClusterController($scope, $q, $uibModal, $ocLazyLoad, mnPoolDefault, mnMemoryQuotaService, mnSettingsClusterService, mnHelper, mnPromiseHelper, mnClusterConfigurationService, mnXDCRService) {
  var vm = this;
  vm.saveVisualInternalSettings = saveVisualInternalSettings;
  vm.onSelectAllXDCRLogLevels = onSelectAllXDCRLogLevels;
  vm.showAllXDCRLogLevels = showAllXDCRLogLevels;
  vm.reloadState = mnHelper.reloadState;
  vm.itemsSelect = [...Array(65).keys()].slice(1);
  vm.isColumnar = true
  vm.credentialsChanged = false;

  activate();

  $scope.$watch('settingsClusterCtl.memoryQuotaConfig', _.debounce(function (memoryQuotaConfig) {
    if (!memoryQuotaConfig || !$scope.rbac.cluster.pools.write) {
      return;
    }
    var promise = mnSettingsClusterService.postPoolsDefault(vm.memoryQuotaConfig, true);
    mnPromiseHelper(vm, promise)
      .catchErrors(function (error) {
        if (error && error.cbasMemoryQuota) {
          error.cbasMemoryQuota = error.cbasMemoryQuota.replace(/analytics/gi, "columnar");
        }
        vm.memoryQuotaErrors = error;
      })
  }, 500), true);

  $scope.$watch('settingsClusterCtl.indexSettings', _.debounce(function (indexSettings, prevIndexSettings) {
    if (!indexSettings || !$scope.rbac.cluster.settings.indexes.write || !(prevIndexSettings && !_.isEqual(indexSettings, prevIndexSettings))) {
      return;
    }
    var promise = mnSettingsClusterService.postIndexSettings(vm.indexSettings, true);
    mnPromiseHelper(vm, promise)
      .catchErrors("indexSettingsErrors");
  }, 500), true);

  let submitted;

  function saveSettings() {
    if (!isFormInitialized() || submitted) {
      return;
    }
    submitted = true;
    var queries = [];
    var promise1 = mnPromiseHelper(vm, mnSettingsClusterService.postPoolsDefault(vm.memoryQuotaConfig, false, vm.clusterName))
        .catchErrors("memoryQuotaErrors")
        .onSuccess(function () {
          vm.initialMemoryQuota = vm.memoryQuotaConfig.indexMemoryQuota;
        })
        .getPromise();
    var promise2;
    var promise3;
    var promise5;
    var promise6;
    var promise7;
    var promise8;
    var promise9;
    var promise10;

    queries.push(promise1);

    // if (vm.replicationSettings.genericServicesLogLevel) {
    //   vm.replicationSettings.genericServicesLogLevel = JSON.stringify(vm.replicationSettings.genericServicesLogLevel);
    // }
    // promise6 = mnPromiseHelper(vm,
    //                            mnXDCRService.postSettingsReplications(vm.replicationSettings))
    //   .catchErrors("replicationSettingsErrors")
    //   .getPromise();
    //
    // queries.push(promise6);

    // if (!_.isEqual(vm.indexSettings, vm.initialIndexSettings) && $scope.rbac.cluster.settings.indexes.write) {
    //   promise2 = mnPromiseHelper(vm, mnSettingsClusterService.postIndexSettings(vm.indexSettings))
    //     .catchErrors("indexSettingsErrors")
    //     .applyToScope("initialIndexSettings")
    //     .getPromise();
    //
    //   queries.push(promise2);
    // }

    if (mnPoolDefault.export.isEnterprise &&
        mnPoolDefault.export.compat.atLeast65 &&
        $scope.rbac.cluster.settings.write) {
      promise7 = mnPromiseHelper(vm, mnSettingsClusterService
                                 .postSettingsRetryRebalance(vm.retryRebalanceCfg))
        .catchErrors("retryRebalanceErrors")
        .getPromise();
      queries.push(promise7);
    }

    if (mnPoolDefault.export.compat.atLeast66 &&
        $scope.rbac.cluster.settings.write) {
      promise9 = mnPromiseHelper(vm, mnSettingsClusterService
                                 .postSettingsRebalance(vm.settingsRebalance))
        .catchErrors("settingsRebalanceErrors")
        .getPromise();
      queries.push(promise9);
    }

    if (vm.isColumnar &&
        $scope.rbac.cluster.settings.write &&
        vm.blobStorageSettings &&
        vm.initialBlobStorageSettings) {
      var rawBlobStoragePromise = mnSettingsClusterService.postBlobStorageSettings(
        vm.blobStorageSettings,
        vm.credentialsChanged
      ).then(function () {
        vm.initialBlobStorageSettings = _.cloneDeep(vm.blobStorageSettings);
        vm.credentialsChanged = false;
      }, function (resp) {
        if (resp.status === -1) {
          return;
        }
        var errors = resp.data && resp.data.errors;
        var messages = errors
          ? Object.entries(errors).map(function(e) {
              return e[0] === '_' ? e[1] : e[0] + ': ' + e[1];
            })
          : (resp.data ? [JSON.stringify(resp.data)] : ['An unknown error occurred.']);
        $uibModal.open({
          template: blobStorageErrorTemplate,
          controller: ['messages', function(messages) { this.messages = messages; }],
          controllerAs: 'blobStorageErrorCtl',
          resolve: {
            messages: function() { return messages; }
          }
        });
        return $q.reject(resp);
      });
      var blobStoragePromise = mnPromiseHelper(vm, rawBlobStoragePromise).getPromise();
      queries.push(blobStoragePromise);
    }

    // if (mnPoolDefault.export.compat.atLeast79 &&
    //     $scope.rbac.cluster.settings.write) {
    //   promise9 = mnPromiseHelper(vm, mnSettingsClusterService
    //       .postSettingsResource(vm.settingsResource))
    //       .catchErrors("settingsResourceErrors")
    //       .getPromise();
    //   queries.push(promise9);
    // }

    // if (mnPoolDefault.export.compat.atLeast71 &&
    //     mnPoolDefault.export.isEnterprise &&
    //     $scope.rbac.cluster.settings.write) {
    //   promise10 = mnPromiseHelper(vm, mnSettingsClusterService
    //                              .postSettingsAnalytics(vm.settingsAnalytics))
    //     .catchErrors("settingsAnalyticsErrors")
    //     .getPromise();
    //   queries.push(promise10);
    // }

    // if ($scope.rbac.cluster.admin.memcached.write) {
    //   promise8 = mnPromiseHelper(vm, mnSettingsClusterService.postMemcachedSettings({
    //     num_reader_threads: packThreadValue('reader'),
    //     num_writer_threads: packThreadValue('writer'),
    //     num_storage_threads: packThreadValue('storage')
    //   }))
    //     .catchErrors("dataServiceSettingsErrors")
    //     .getPromise();
    //   queries.push(promise8);
    // }

    queries = queries.concat(mnSettingsClusterService.getSubmitCallbacks().map(function (cb) {
      return cb();
    }));

    var promiseAll = $q.all(queries)
        .finally(() => (submitted = false));
    mnPromiseHelper(vm, promiseAll)
      .showGlobalSpinner()
      .reloadState()
      .showGlobalSuccess("Settings saved successfully!");
  }
  function packThreadValue(type) {
    switch (vm[type + 'Threads']) {
    case "fixed": return vm[type + 'ThreadsFixed'];
    default: return vm[type + 'Threads'];
    }
  }
  function unpackThreadValue(value) {
    switch (typeof value) {
    case "string": return value;
    case "number": return "fixed";
    default: return "default";
    }
  }
  function unpackThreadsCount(value) {
    switch (typeof value) {
    case "number": return value;
    default: return 4;
    }
  }
  function saveVisualInternalSettings() {
    if (vm.clusterSettingsLoading) {
      return;
    }
    saveSettings();
    // if ((!vm.indexSettings || vm.indexSettings.storageMode === "forestdb") && vm.initialMemoryQuota != vm.memoryQuotaConfig.indexMemoryQuota) {
    //   $uibModal.open({
    //     template,
    //   }).result.then(saveSettings);
    // } else {
    //   saveSettings();
    // }
  }
  function isFormInitialized() {
    let compat = mnPoolDefault.export.compat;
    let cluster = $scope.rbac.cluster;
    return (vm.clusterName != void 0) && (vm.initialMemoryQuota != void 0) &&
      // (cluster.xdcr.settings.read ? (vm.replicationSettings != void 0) : true) &&
      // (cluster.admin.memcached.read ? (vm.readerThreads != void 0) : true) &&
      ((compat.atLeast66 && cluster.settings.read) ? (vm.settingsRebalance != void 0) : true) &&
      ((compat.atLeast65 && mnPoolDefault.export.isEnterprise && cluster.settings.read) ?
       (vm.retryRebalanceCfg != void 0) : true) &&
      // (cluster.settings.indexes.read ? (vm.indexSettings != void 0) : true) &&
      // ((compat.atLeast71 && mnPoolDefault.export.isEnterprise && cluster.settings.read) ?
      //   (vm.settingsAnalytics != void 0) : true) &&
      ((vm.isColumnar && cluster.settings.read) ? (vm.blobStorageSettings != void 0) : true) &&

      mnSettingsClusterService.getInitChecker().every(v => v());
  }
  function onSelectAllXDCRLogLevels(selectedOption) {
    vm.XDCRServices.map(XDCRService => vm.replicationSettings.genericServicesLogLevel[XDCRService] = selectedOption);
  }
  async function showAllXDCRLogLevels() {
    await import("./mn_settings_cluster_all_xdcr_log_levels_dialog_controller.js");
    await $ocLazyLoad.load({name: 'mnSettingsClusterAllXDCRLogLevelsDialogController'});
    $uibModal.open({
      template: allXDCRLogLevelsTemplate,
      controller: 'mnSettingsClusterAllXDCRLogLevelsDialogController as allXDCRLogLevelsDialogCtl',
      resolve: {
        logLevels: function() {
          return vm.replicationSettings.genericServicesLogLevel;
        },
        initialLogLevels: function() {
          return vm.initialServicesLogLevels;
        }
      }
    });
  }
  function activate() {
    mnSettingsClusterService.clearSubmitCallbacks();
    mnSettingsClusterService.clearInitChecker();

    mnPromiseHelper(vm, mnPoolDefault.get())
      .applyToScope(function (resp) {
        vm.clusterName = resp.clusterName;
      });

    var services = {
      kv: true,
      index: true,
      fts: true
    };

    if (mnPoolDefault.export.isEnterprise) {
      services.cbas = mnPoolDefault.export.compat.atLeast55;
      services.eventing = mnPoolDefault.export.compat.atLeast55;
      services.backup = mnPoolDefault.export.compat.atLeast70;
    }
    services.n1ql = mnPoolDefault.export.compat.atLeast76;

    // if ($scope.rbac.cluster.xdcr.settings.read) {
    //   mnXDCRService.getSettingsReplications().then(function (rv) {
    //     vm.replicationSettings = rv.data;
    //     vm.initialServicesLogLevels = _.clone(vm.replicationSettings.genericServicesLogLevel);
    //     vm.XDCRServices = Object.keys(vm.replicationSettings.genericServicesLogLevel);
    //     vm.replicationSettings.xdcrAllLogLevels =
    //       Object.values(vm.replicationSettings.genericServicesLogLevel).every(logLevel => logLevel === vm.replicationSettings.genericServicesLogLevel[vm.XDCRServices[0]]) ?
    //         vm.replicationSettings.genericServicesLogLevel[vm.XDCRServices[0]] :
    //         null;
    //     vm.logValues = ["Info", "Trace", "Debug", "Error"];
    //   });
    // }

    if (mnPoolDefault.export.compat.atLeast71  &&
        mnPoolDefault.export.isEnterprise &&
        $scope.rbac.cluster.settings.read) {
      mnSettingsClusterService.getSettingsAnalytics()
        .then(settings => vm.settingsAnalytics = settings);
    }

    if (vm.isColumnar && $scope.rbac.cluster.settings.read) {
      mnSettingsClusterService.getSettingsAnalytics()
        .then(function(settings) {
          // Join certificates array to a single string for the textarea
          if (Array.isArray(settings.blobStorageCertificates)) {
            settings.blobStorageCertificates = settings.blobStorageCertificates.join('\n');
          }
          vm.blobStorageSettings = settings;
          vm.initialBlobStorageSettings = _.cloneDeep(settings);
          vm.blobStorageSchemeName = getBlobStorageSchemeName(settings.blobStorageScheme, settings.blobStorageEndpoint);
          vm.blobStorageIsS3 = settings.blobStorageScheme === 's3';
          // Track whether this is an s3-compat config (s3 scheme with an endpoint at load time).
          // Once true, the endpoint field stays visible even if the user clears it.
          vm.blobStorageIsS3Compat = settings.blobStorageScheme === 's3' && !!settings.blobStorageEndpoint;
          vm.blobStorageEndpointIsHttp = isEndpointHttp(settings.blobStorageEndpoint);
          vm.blobStorageCredentialMode = getCredentialMode(settings);

          $scope.$watch('settingsClusterCtl.blobStorageSettings.blobStorageEndpoint', function(val) {
            vm.blobStorageEndpointIsHttp = isEndpointHttp(val);
          });

          // Mask the secret access key for display
          if (settings.blobStorageSecretAccessKey) {
            vm.blobStorageSettings.blobStorageSecretAccessKey = '***';
          }

          // Register init checker for blob storage settings
          mnSettingsClusterService.registerInitChecker(function() {
            return vm.blobStorageSettings !== undefined;
          });

          // Watch for credential changes
          $scope.$watch('settingsClusterCtl.blobStorageSettings.blobStorageAccessKeyId', function(newVal, oldVal) {
            if (newVal !== oldVal && newVal !== undefined && newVal !== vm.initialBlobStorageSettings.blobStorageAccessKeyId) {
              vm.credentialsChanged = true;
            }
          });
          $scope.$watch('settingsClusterCtl.blobStorageSettings.blobStorageSecretAccessKey', function(newVal, oldVal) {
            if (newVal !== oldVal && newVal !== undefined && newVal !== '***') {
              vm.credentialsChanged = true;
            }
          });

          // Watch for credential mode changes
          $scope.$watch('settingsClusterCtl.blobStorageCredentialMode', function(newVal, oldVal) {
            if (newVal !== oldVal) {
              if (newVal === 'anonymous') {
                vm.blobStorageSettings.blobStorageAnonymousAuth = true;
                vm.blobStorageSettings.blobStorageAccessKeyId = '';
                vm.blobStorageSettings.blobStorageSecretAccessKey = '***';
              } else if (newVal === 'chain') {
                vm.blobStorageSettings.blobStorageAnonymousAuth = false;
                vm.blobStorageSettings.blobStorageAccessKeyId = '';
                vm.blobStorageSettings.blobStorageSecretAccessKey = '***';
              } else if (newVal === 'static') {
                vm.blobStorageSettings.blobStorageAnonymousAuth = false;
              }
            }
          });
        });
    }

    if ($scope.rbac.cluster.admin.memcached.read) {
      mnSettingsClusterService.getMemcachedSettings().then(function (rv) {
        vm.readerThreads = unpackThreadValue(rv.data.num_reader_threads);
        vm.writerThreads = unpackThreadValue(rv.data.num_writer_threads);
        vm.storageThreads = unpackThreadValue(rv.data.num_storage_threads);
        vm.readerThreadsFixed = unpackThreadsCount(rv.data.num_reader_threads);
        vm.writerThreadsFixed = unpackThreadsCount(rv.data.num_writer_threads);
        vm.storageThreadsFixed = unpackThreadsCount(rv.data.num_storage_threads);
      });
    }

    if (mnPoolDefault.export.compat.atLeast66 &&
        $scope.rbac.cluster.settings.read) {
      mnSettingsClusterService.getSettingsRebalance().then(settings => {
        vm.settingsRebalance = settings.data;
      });
    }

    if (mnPoolDefault.export.compat.atLeast79 &&
        $scope.rbac.cluster.settings.read) {
      mnSettingsClusterService.getSettingsResource().then(settings => {
        vm.settingsResource = settings.data;
      });
    }

    if (mnPoolDefault.export.compat.atLeast65 &&
        mnPoolDefault.export.isEnterprise &&
        $scope.rbac.cluster.settings.read) {
      mnSettingsClusterService.getSettingsRetryRebalance().then(function (data) {
        vm.retryRebalanceCfg = data;

        if (!$scope.rbac.cluster.settings.write) {
          return;
        }

        $scope.$watch('settingsClusterCtl.retryRebalanceCfg', _.debounce(function (values) {
          mnPromiseHelper(vm, mnSettingsClusterService
                          .postSettingsRetryRebalance(values, {just_validate: 1}))
            .catchErrors("retryRebalanceErrors");
        }, 500, {leading: true}), true);
      });
    }

    mnPromiseHelper(vm, mnMemoryQuotaService.memoryQuotaConfig(services, false, false))
      .applyToScope(function (resp) {
        vm.initialMemoryQuota = resp.indexMemoryQuota;
        vm.memoryQuotaConfig = resp;
      });

    if ($scope.rbac.cluster.settings.indexes.read) {
      mnPromiseHelper(vm, mnSettingsClusterService.getIndexSettings())
        .applyToScope(function (indexSettings) {
          vm.indexSettings = indexSettings;
          vm.initialIndexSettings = _.clone(indexSettings);
        });
    }
  }

  function getBlobStorageSchemeName(scheme, endpoint) {
    if (!scheme || scheme === 'none' || scheme === '') {
      return 'None';
    }
    if (scheme === 's3') {
      return endpoint ? 'S3-Compatible Storage' : 'AWS S3';
    }
    if (scheme === 'azblob') {
      return 'Azure Blob Storage';
    }
    if (scheme === 'gs') {
      return 'Google Cloud Storage';
    }
    return scheme;
  }

  function isEndpointHttp(endpoint) {
    return !!(endpoint && !endpoint.toLowerCase().startsWith('https://'));
  }

  function getCredentialMode(settings) {
    if (settings.blobStorageAnonymousAuth) {
      return 'anonymous';
    }
    if (settings.blobStorageAccessKeyId && settings.blobStorageAccessKeyId !== '') {
      return 'static';
    }
    return 'chain';
  }
}
