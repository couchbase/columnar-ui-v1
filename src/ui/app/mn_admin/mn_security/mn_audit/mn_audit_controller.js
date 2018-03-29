(function () {
  "use strict";

  angular.module('mnAudit', [
    'mnAuditService',
    'mnHelper',
    'mnPromiseHelper',
    'mnFilters'
  ]).controller('mnAuditController', mnAuditController);

  function mnAuditController($scope, mnAuditService, mnPromiseHelper, mnHelper) {
    var vm = this;

    vm.submit = submit;
    vm.toggleAll = toggleAll;
    vm.mapNames = mapNames;
    vm.findEnabled = findEnabled;

    activate();

    function mapNames(name) {
      switch (name) {
      case "auditd":
        return "Audit";
      case "ns_server":
        return "Server";
      case "n1ql":
        return "Query and Index Service";
      case "eventing":
        return "Eventing Service";
      case "memcached":
        return "Data Service";
      case "xdcr":
        return name.toUpperCase();
      case "fts":
        return "Search Service";
      default:
        return name.charAt(0).toUpperCase() + name.substr(1).toLowerCase();
      }
    }

    function findEnabled(moduleName, bool) {
      return !!_.find(vm.state.eventsDescriptors[moduleName], {enabledByUI: bool});
    }
    function setEnabled(moduleName, bool) {
      vm.state.eventsDescriptors[moduleName].forEach(function (desc) {
        desc.enabledByUI = bool;
      });
    }
    function toggleAll(moduleName) {
      setEnabled(moduleName, findEnabled(moduleName, false));
    }
    function activate() {
      mnPromiseHelper(vm, mnAuditService.getState())
        .applyToScope("state");

      $scope.$watch('auditCtl.state', _.debounce(watchOnState, 500), true);
    }
    function watchOnState(state) {
      if (!state || !$scope.rbac.cluster.admin.security.write) {
        return;
      }
      mnPromiseHelper(vm, mnAuditService.saveAuditSettings(state, true))
        .catchErrorsFromSuccess();
    }
    function submit() {
      if ($scope.viewLoading) {
        return;
      }
      mnPromiseHelper(vm, mnAuditService.saveAuditSettings(vm.state))
        .catchErrorsFromSuccess()
        .showSpinner()
        .reloadState("app.admin.security")
        .showGlobalSuccess("Audit settings changed successfully!");
    };
  }
})();
