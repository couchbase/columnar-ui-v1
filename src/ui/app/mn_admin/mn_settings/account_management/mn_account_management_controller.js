(function () {
  "use strict";

  angular
    .module("mnAccountManagement", [
      "mnAccountManagementService",
      "mnPromiseHelper",
      "mnHelper",
      "mnSpinner",
      "mnPoolDefault"
    ])
    .controller("mnAccountManagementController", mnAccountManagementController);

  function mnAccountManagementController($scope, $uibModal, mnAccountManagementService, mnPromiseHelper, mnHelper, mnPoolDefault) {
    var vm = this;

    vm.creds = {};

    vm.createUser = createUser;
    vm.deleteUser = deleteUser;
    vm.resetUserPassword = resetUserPassword;
    vm.mnPoolDefault = mnPoolDefault.latestValue();

    if (vm.mnPoolDefault.value.isROAdminCreds) {
      return;
    }

    activate();

    function deleteUser() {
      return $uibModal.open({
        templateUrl: 'app/mn_admin/mn_settings/account_management/delete/mn_account_management_delete.html',
        controller: 'mnAccountManagementDeleteController as accountManagementDeleteCtl',
        resolve: {
          name: mnHelper.wrapInFunction(vm.roAdminName)
        }
      });
    }
    function resetUserPassword() {
      return $uibModal.open({
        templateUrl: 'app/mn_admin/mn_settings/account_management/reset/mn_account_management_reset.html',
        controller: 'mnAccountManagementResetController as accountManagementResetCtl'
      });
    }
    function createUser() {
      if (vm.viewLoading) {
        return;
      }

      mnPromiseHelper(vm, mnAccountManagementService.postReadOnlyAdminName(vm.creds, true))
        .showErrorsSensitiveSpinner()
        .catchErrors()
        .onSuccess(function () {
          mnPromiseHelper(vm, mnAccountManagementService.postReadOnlyAdminName(vm.creds))
            .reloadState();
        });
    }
    function activate() {
      mnPromiseHelper(vm, mnAccountManagementService.getAccountManagmentState())
        .showSpinner()
        .applyToScope("roAdminName");
    }
  }
})();
