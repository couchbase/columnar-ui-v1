import angular from "/ui/web_modules/angular.js";
import _ from "/ui/web_modules/lodash.js";
import uiBootstrap from "/ui/web_modules/angular-ui-bootstrap.js";
import mnPoolDefault from "/ui/app/components/mn_pool_default.js";
import mnPromiseHelper from "/ui/app/components/mn_promise_helper.js";
import mnSettingsClusterService from "/ui/app/mn_admin/mn_settings_cluster_service.js";
import mnMemoryQuota from "/ui/app/components/directives/mn_memory_quota/mn_memory_quota.js";

export default 'mnMemoryQuotaDialogController';

angular.module('mnMemoryQuotaDialogController', [
  uiBootstrap,
  mnPoolDefault,
  mnPromiseHelper,
  mnSettingsClusterService,
  mnMemoryQuota
])
  .controller('mnMemoryQuotaDialogController', mnMemoryQuotaDialogController)

function mnMemoryQuotaDialogController($q, $uibModalInstance, mnPoolDefault, mnPromiseHelper, mnSettingsClusterService, indexSettings, memoryQuotaConfig, firstTimeAddedServices) {
  var vm = this;
  vm.config = memoryQuotaConfig;
  vm.isEnterprise = mnPoolDefault.latestValue().value.isEnterprise;
  vm.onSubmit = onSubmit;
  vm.initialIndexSettings = _.clone(indexSettings);
  vm.indexSettings = indexSettings;
  vm.firstTimeAddedServices = firstTimeAddedServices;
  vm.getFirstTimeServiceNames = getFirstTimeServiceNames;

  if (indexSettings.storageMode === "") {
    vm.indexSettings.storageMode = vm.isEnterprise ? "plasma" : "forestdb";
  }

  function onSubmit() {
    if (vm.viewLoading) {
      return;
    }

    var queries = [
      mnPromiseHelper(vm, mnSettingsClusterService.postPoolsDefault(vm.config))
        .catchErrors()
        .getPromise()
    ];

    if (vm.firstTimeAddedServices.index) {
      queries.push(
        mnPromiseHelper(vm, mnSettingsClusterService.postIndexSettings(vm.indexSettings))
          .catchErrors("postIndexSettingsErrors")
          .getPromise()
      );
    }
    var promise = $q.all(queries);

    mnPromiseHelper(vm, promise, $uibModalInstance)
      .showGlobalSpinner()
      .closeOnSuccess()
      .showGlobalSuccess("Memory quota saved successfully!");
  }

  function getFirstTimeServiceNames() {
    var services = [];
    if (firstTimeAddedServices.index)
      services.push("GSI Index");
    if (firstTimeAddedServices.fts)
      services.push("Full Text");
    if (firstTimeAddedServices.cbas)
      services.push("Analytics");
    if (firstTimeAddedServices.eventing)
      services.push("Eventing");

    return services;
  }
}
