import angular from "/ui/web_modules/angular.js";
import _ from "/ui/web_modules/lodash.js";

import mnHelper from "/ui/app/components/mn_helper.js";
import mnSpinner from "/ui/app/components/directives/mn_spinner.js";
import mnField from "/ui/app/components/directives/mn_field_directive.js";
import mnPromiseHelper from "/ui/app/components/mn_promise_helper.js";
import mnMemoryQuota from "/ui/app/components/directives/mn_memory_quota/mn_memory_quota.js";
import mnStorageMode from "/ui/app/components/directives/mn_storage_mode/mn_storage_mode.js";

import mnPoolDefault from "/ui/app/components/mn_pool_default.js";

import mnSettingsClusterService from "./mn_settings_cluster_service.js";
import mnXDCRService from "./mn_xdcr_service.js";
import mnMemoryQuotaService from "/ui/app/components/directives/mn_memory_quota/mn_memory_quota_service.js";
import mnClusterConfigurationService from "/ui/app/mn_wizard/mn_cluster_configuration/mn_cluster_configuration_service.js";

export default 'mnSettingsCluster';

angular.module('mnSettingsCluster', [
  mnHelper,
  mnSpinner,
  mnField,
  mnPromiseHelper,
  mnMemoryQuota,
  mnStorageMode,
  mnPoolDefault,
  mnMemoryQuotaService,
  mnXDCRService,
  mnSettingsClusterService,
  mnClusterConfigurationService,
]).controller('mnSettingsClusterController', mnSettingsClusterController);

function mnSettingsClusterController($scope, $q, $uibModal, mnPoolDefault, mnMemoryQuotaService, mnSettingsClusterService, mnHelper, mnPromiseHelper, mnClusterConfigurationService, mnXDCRService) {
  var vm = this;
  vm.saveVisualInternalSettings = saveVisualInternalSettings;
  vm.reloadState = mnHelper.reloadState;
  vm.itemsSelect = [...Array(65).keys()].slice(1);

  activate();

  $scope.$watch('settingsClusterCtl.memoryQuotaConfig', _.debounce(function (memoryQuotaConfig) {
    if (!memoryQuotaConfig || !$scope.rbac.cluster.pools.write) {
      return;
    }
    var promise = mnSettingsClusterService.postPoolsDefault(vm.memoryQuotaConfig, true);
    mnPromiseHelper(vm, promise)
      .catchErrorsFromSuccess("memoryQuotaErrors");
  }, 500), true);

  $scope.$watch('settingsClusterCtl.indexSettings', _.debounce(function (indexSettings, prevIndexSettings) {
    if (!indexSettings || !$scope.rbac.cluster.settings.indexes.write || !(prevIndexSettings && !_.isEqual(indexSettings, prevIndexSettings))) {
      return;
    }
    var promise = mnSettingsClusterService.postIndexSettings(vm.indexSettings, true);
    mnPromiseHelper(vm, promise)
      .catchErrorsFromSuccess("indexSettingsErrors");
  }, 500), true);

  function saveSettings() {
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
    var promise8;
    var promise7;
    var promise8;
    var promise9;

    promise6 = mnPromiseHelper(vm,
                               mnXDCRService.postSettingsReplications(vm.replicationSettings))
      .catchErrors("replicationSettingsErrors")
      .getPromise();

    queries.push(promise6);

    if (!_.isEqual(vm.indexSettings, vm.initialIndexSettings) && $scope.rbac.cluster.settings.indexes.write) {
      promise2 = mnPromiseHelper(vm, mnSettingsClusterService.postIndexSettings(vm.indexSettings))
        .catchErrors("indexSettingsErrors")
        .applyToScope("initialIndexSettings")
        .getPromise();

      queries.push(promise2);
    }

    if (mnPoolDefault.export.compat.atLeast55 && $scope.rbac.cluster.settings.write) {
      let settings = [
        "queryTmpSpaceDir", "queryTmpSpaceSize", "queryPipelineBatch", "queryPipelineCap",
        "queryScanCap", "queryTimeout", "queryPreparedLimit", "queryCompletedLimit",
        "queryCompletedThreshold", "queryLogLevel", "queryMaxParallelism",
        "queryN1QLFeatCtrl"
      ];
      if (mnPoolDefault.export.compat.atLeast70) {
        settings = settings.concat(["queryTxTimeout", "queryMemoryQuota", "queryUseCBO"]);
      }
      promise3 = mnPromiseHelper(
        vm,
        mnClusterConfigurationService.postQuerySettings(
          settings.reduce(function (acc, key) {
            acc[key] = vm.querySettings[key];
            return acc;
          }, {})))
        .catchErrors("querySettingsErrors")
        .getPromise();

      promise5 = mnPromiseHelper(vm, mnClusterConfigurationService.postCurlWhitelist(
        vm.querySettings.queryCurlWhitelist,
        vm.initialCurlWhitelist
      ))
        .catchErrors("curlWhitelistErrors")
        .onSuccess(prepareQueryCurl)
        .getPromise();

      queries.push(promise3, promise5);
    }

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

    if ($scope.rbac.cluster.admin.memcached.write) {
      promise8 = mnPromiseHelper(vm, mnSettingsClusterService.postMemcachedSettings({
        num_reader_threads: packThreadValue('reader'),
        num_writer_threads: packThreadValue('writer'),
        num_storage_threads: packThreadValue('storage')
      }))
        .catchErrors("dataServiceSettingsErrors")
        .getPromise();
      queries.push(promise8);
    }

    queries = queries.concat(mnSettingsClusterService.getSubmitCallbacks().map(function (cb) {
      return cb();
    }));

    var promiseAll = $q.all(queries);
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
  function unpackThreadValue(value, settings) {
    switch (typeof value) {
    case "string": return value;
    case "number": return "fixed";
    default: return "default";
    }
  }
  function unpackThreadsCount(value) {
    switch (typeof value) {
    case "number": return value.toString();
    default: return "4";
    }
  }
  function saveVisualInternalSettings() {
    if (vm.clusterSettingsLoading) {
      return;
    }
    if ((!vm.indexSettings || vm.indexSettings.storageMode === "forestdb") && vm.initialMemoryQuota != vm.memoryQuotaConfig.indexMemoryQuota) {
      $uibModal.open({
        templateUrl: 'app/mn_admin/mn_settings_cluster_confirmation_dialog.html'
      }).result.then(saveSettings);
    } else {
      saveSettings();
    }
  }
  function maybeSetInititalValue(array, value) {
    if (array.length === 0) {
      array.push(value);
    }
  }
  function prepareQueryCurl(querySettings) {
    var queryCurl = querySettings.queryCurlWhitelist;
    queryCurl.allowed_urls = queryCurl.allowed_urls || [];
    queryCurl.disallowed_urls = queryCurl.disallowed_urls || [];
    maybeSetInititalValue(queryCurl.allowed_urls, "");
    maybeSetInititalValue(queryCurl.disallowed_urls, "");
    vm.initialCurlWhitelist = _.cloneDeep(queryCurl);
    vm.querySettings = querySettings;
  }
  function activate() {
    mnSettingsClusterService.clearSubmitCallbacks();

    mnPromiseHelper(vm, mnPoolDefault.get())
      .applyToScope(function (resp) {
        vm.clusterName = resp.clusterName;
      });

    if (mnPoolDefault.export.compat.atLeast55 && $scope.rbac.cluster.settings.read) {
      mnPromiseHelper(vm, mnClusterConfigurationService.getQuerySettings())
        .onSuccess(prepareQueryCurl);
    }

    var services = {
      kv: true,
      index: true,
      fts: true,
      n1ql: true
    };

    if (mnPoolDefault.export.isEnterprise) {
      services.cbas = mnPoolDefault.export.compat.atLeast55;
      services.eventing = mnPoolDefault.export.compat.atLeast55;
      services.backup = mnPoolDefault.export.compat.atLeast70;
    }

    mnXDCRService.getSettingsReplications().then(function (rv) {
      vm.replicationSettings = rv.data;
    });

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
            .catchErrorsFromSuccess("retryRebalanceErrors");
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
}
