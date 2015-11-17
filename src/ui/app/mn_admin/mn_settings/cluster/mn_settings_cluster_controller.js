(function () {
  "use strict";

  angular.module('mnSettingsCluster', [
    'mnSettingsClusterService',
    'mnHelper',
    'mnPromiseHelper',
    'mnMemoryQuota',
    'mnSpinner'
  ]).controller('mnSettingsClusterController', mnSettingsClusterController);

  function mnSettingsClusterController($scope, $uibModal, mnSettingsClusterService, mnHelper, mnPromiseHelper, mnPoolDefault) {
    var vm = this;
    vm.mnPoolDefault = mnPoolDefault.latestValue();
    vm.toggleCertArea = toggleCertArea;
    vm.saveVisualInternalSettings = saveVisualInternalSettings;
    vm.regenerateCertificate = regenerateCertificate;

    activate();

    if (vm.mnPoolDefault.value.isROAdminCreds) {
      return;
    }

    $scope.$watch('mnSettingsClusterController.state.memoryQuotaConfig', _.debounce(function (memoryQuotaConfig) {
      if (!memoryQuotaConfig) {
        return;
      }
      var promise = mnSettingsClusterService.postPoolsDefault(vm.state.memoryQuotaConfig, true);
      mnPromiseHelper(vm, promise)
        .catchErrorsFromSuccess("memoryQuotaErrors")
        .cancelOnScopeDestroy($scope);
    }, 500), true);

    $scope.$watch('mnSettingsClusterController.state.indexSettings', _.debounce(function (indexSettings) {
      if (!indexSettings) {
        return;
      }
      var promise = mnSettingsClusterService.postIndexSettings(vm.state.indexSettings, true);
      mnPromiseHelper(vm, promise)
        .catchErrorsFromSuccess("indexSettingsErrors")
        .cancelOnScopeDestroy($scope);
    }, 500), true);

    function saveSettings() {
      var promise = mnPromiseHelper(vm, mnSettingsClusterService.postPoolsDefault(vm.state.memoryQuotaConfig, false, vm.state.clusterName))
        .catchErrors("memoryQuotaErrors")
        .cancelOnScopeDestroy($scope)
        .getPromise()
        .then(function () {
          return mnPromiseHelper(vm, mnSettingsClusterService.postIndexSettings(vm.state.indexSettings))
            .catchErrors("indexSettingsErrors")
            .cancelOnScopeDestroy($scope)
            .getPromise();
        })
      mnPromiseHelper(vm, promise)
        .showSpinner('clusterSettingsLoading')
        .reloadState();
    }
    function saveVisualInternalSettings() {
      if (vm.clusterSettingsLoading) {
        return;
      }
      if (vm.state.initialMemoryQuota != vm.state.memoryQuotaConfig.indexMemoryQuota) {
        $uibModal.open({
          templateUrl: 'app/mn_admin/mn_settings/cluster/mn_settings_cluster_confirmation_dialog.html'
        }).result.then(saveSettings);
      } else {
        saveSettings();
      }
    }
    function regenerateCertificate() {
      if (vm.regenerateCertificateInprogress) {
        return;
      }
      mnPromiseHelper(vm, mnSettingsClusterService.regenerateCertificate())
        .onSuccess(function (certificate) {
          vm.state.certificate = certificate;
        })
        .showSpinner('regenerateCertificateInprogress')
        .cancelOnScopeDestroy($scope);
    }
    function activate() {
      mnPromiseHelper(vm, mnSettingsClusterService.getClusterState())
        .applyToScope("state")
        .cancelOnScopeDestroy($scope);
    }
    function toggleCertArea() {
      vm.toggleCertAreaFlag = !vm.toggleCertAreaFlag;
    }
  }
})();

