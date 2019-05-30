(function () {
  "use strict";

  angular.module('mnSettingsCluster', [
    'mnSettingsClusterService',
    'mnHelper',
    'mnPromiseHelper',
    'mnMemoryQuota',
    'mnStorageMode',
    'mnPoolDefault',
    'mnMemoryQuotaService',
    'mnSpinner',
    'mnClusterConfigurationService',
    'mnXDCRService'
  ]).controller('mnSettingsClusterController', mnSettingsClusterController);

  function mnSettingsClusterController($scope, $q, $uibModal, mnPoolDefault, mnMemoryQuotaService, mnSettingsClusterService, mnHelper, mnPromiseHelper, mnClusterConfigurationService, mnXDCRService) {
    var vm = this;
    vm.saveVisualInternalSettings = saveVisualInternalSettings;
    vm.reloadState = mnHelper.reloadState;

    activate();

    $scope.$watch('settingsClusterCtl.memoryQuotaConfig', _.debounce(function (memoryQuotaConfig) {
      if (!memoryQuotaConfig || !$scope.rbac.cluster.pools.write) {
        return;
      }
      var promise = mnSettingsClusterService.postPoolsDefault(vm.memoryQuotaConfig, true);
      mnPromiseHelper(vm, promise)
        .catchErrorsFromSuccess("memoryQuotaErrors");
    }, 500), true);

    if (mnPoolDefault.export.compat.atLeast40) {
      $scope.$watch('settingsClusterCtl.indexSettings', _.debounce(function (indexSettings, prevIndexSettings) {
        if (!indexSettings || !$scope.rbac.cluster.settings.indexes.write || !(prevIndexSettings && !_.isEqual(indexSettings, prevIndexSettings))) {
          return;
        }
        var promise = mnSettingsClusterService.postIndexSettings(vm.indexSettings, true);
        mnPromiseHelper(vm, promise)
          .catchErrorsFromSuccess("indexSettingsErrors");
      }, 500), true);
    }

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
      var promise7 =
          mnPromiseHelper(vm, mnSettingsClusterService
                          .postSettingsRetryRebalance(vm.retryRebalanceCfg))
          .catchErrors("retryRebalanceErrors")
          .getPromise();

      promise6 = mnPromiseHelper(vm,
                                 mnXDCRService.postSettingsReplications(vm.replicationSettings))
        .catchErrors("replicationSettingsErrors")
        .getPromise();

      queries.push(promise6);

      if (!_.isEqual(vm.indexSettings, vm.initialIndexSettings) && mnPoolDefault.export.compat.atLeast40 && $scope.rbac.cluster.settings.indexes.write) {
        promise2 = mnPromiseHelper(vm, mnSettingsClusterService.postIndexSettings(vm.indexSettings))
            .catchErrors("indexSettingsErrors")
            .applyToScope("initialIndexSettings")
            .getPromise();

        queries.push(promise2);
      }

      if (mnPoolDefault.export.compat.atLeast55 && $scope.rbac.cluster.settings.write) {
        promise3 = mnPromiseHelper(vm, mnClusterConfigurationService.postQuerySettings({
          queryTmpSpaceDir: vm.querySettings.queryTmpSpaceDir,
          queryTmpSpaceSize: vm.querySettings.queryTmpSpaceSize
        }))
            .catchErrors("querySettingsErrors")
            .getPromise();

        promise5 = mnPromiseHelper(vm, mnClusterConfigurationService.postCurlWhitelist(
          vm.querySettings.queryCurlWhitelist,
          vm.initialCurlWhitelist
        ))
          .catchErrors("curlWhitelistErrors")
          .onSuccess(prepareQueryCurl)
          .getPromise();

        queries.push(promise3);
        queries.push(promise5);
        queries.push(promise7);
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
    function saveVisualInternalSettings() {
      if (vm.clusterSettingsLoading) {
        return;
      }
      if ((!vm.indexSettings || vm.indexSettings.storageMode === "forestdb") && vm.initialMemoryQuota != vm.memoryQuotaConfig.indexMemoryQuota) {
        $uibModal.open({
          templateUrl: 'app/mn_admin/mn_settings/cluster/mn_settings_cluster_confirmation_dialog.html'
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
        index: mnPoolDefault.export.compat.atLeast40,
        fts: mnPoolDefault.export.compat.atLeast45,
        n1ql: mnPoolDefault.export.compat.atLeast40
      };

      if (mnPoolDefault.export.isEnterprise) {
        services.cbas = mnPoolDefault.export.compat.atLeast55;
        services.eventing = mnPoolDefault.export.compat.atLeast55;
      }

      mnXDCRService.getSettingsReplications().then(function (rv) {
        vm.replicationSettings = rv.data;
      });

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

      mnPromiseHelper(vm, mnMemoryQuotaService.memoryQuotaConfig(services, false, false))
        .applyToScope(function (resp) {
          vm.initialMemoryQuota = resp.indexMemoryQuota;
          vm.memoryQuotaConfig = resp;
        });

      if (mnPoolDefault.export.compat.atLeast40 && $scope.rbac.cluster.settings.indexes.read) {
        mnPromiseHelper(vm, mnSettingsClusterService.getIndexSettings())
          .applyToScope(function (indexSettings) {
            vm.indexSettings = indexSettings;
            vm.initialIndexSettings = _.clone(indexSettings);
          });
      }
    }
  }
})();
