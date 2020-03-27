import angular from "/ui/web_modules/angular.js";
import mnFocus from "/ui/app/components/directives/mn_focus.js";
import mnMemoryQuotaService from "/ui/app/components/directives/mn_memory_quota/mn_memory_quota_service.js";
import mnServices from "/ui/app/components/directives/mn_services/mn_services.js";

export default "mnMemoryQuota";

angular
  .module('mnMemoryQuota', [mnServices, mnFocus, mnMemoryQuotaService])
  .directive('mnMemoryQuota', mnMemoryQuotaDirective);

function mnMemoryQuotaDirective($window, mnMemoryQuotaService) {
  var mnMemoryQuota = {
    restrict: 'A',
    scope: {
      config: '=mnMemoryQuota',
      errors: "=",
      rbac: "=",
      mnIsEnterprise: "="
    },
    templateUrl: 'app/components/directives/mn_memory_quota/mn_memory_quota.html',
    controller: controller
  };

  return mnMemoryQuota;

  function controller($scope) {
    //hack for avoiding access to $parent scope from child scope via propery "$parent"
    //should be removed after implementation of Controller As syntax
    $scope.mnMemoryQuotaController = $scope;

    $scope.change = mnMemoryQuotaService.handleAltAndClick;

    $scope.calculateTotalQuota = calculateTotalQuota;

    function getServiceFieldName(service) {
      switch (service) {
      case "kv": return "memoryQuota";
      default: return (service + "MemoryQuota");
      }
    }

    function calculateTotalQuota() {
      return Object
        .keys($scope.config.services.model)
        .reduce(function (total, service) {
          var cfg = $scope.config;
          var fieldName = getServiceFieldName(service);

          if (cfg.displayedServices[service] &&
              cfg.services && cfg.services.model[service] &&
              cfg[fieldName]) {
            return total + (Number(cfg[fieldName]) || 0);
          } else {
            return total;
          }

        }, 0);
    }
  }
}
