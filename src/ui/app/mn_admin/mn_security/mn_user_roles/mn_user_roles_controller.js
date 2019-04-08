(function () {
  "use strict";

  angular
    .module("mnUserRoles", [
      "mnUserRolesService",
      "mnUserRolesList",
      "mnHelper",
      "mnPromiseHelper",
      "mnPoll",
      "mnSortableTable",
      "mnSpinner",
      "ui.select",
      "mnLdapService",
      "mnEqual",
      "mnFilters",
      "mnAutocompleteOff",
      "mnFocus",
      "mnSaslauthdAuth"
    ])
    .controller("mnUserRolesController", mnUserRolesController);

  function mnUserRolesController($scope, $uibModal, mnLdapService, mnPromiseHelper, mnUserRolesService, mnPoller, mnHelper, $state, poolDefault) {
    var vm = this;
    vm.addUser = addUser;
    vm.addLDAP = addLDAP;
    vm.deleteUser = deleteUser;
    vm.editUser = editUser;
    vm.resetUserPassword = resetUserPassword;

    vm.filterField = "";

    vm.stateParams = $state.params;

    vm.isLdapEnabled = poolDefault.saslauthdEnabled;

    vm.pageSize = $state.params.pageSize;
    vm.pageSizeChanged = pageSizeChanged;
    vm.sortByChanged = sortByChanged;
    vm.isOrderBy = isOrderBy;
    vm.isDesc = isDesc;

    activate();

    function isOrderBy(sortBy) {
      return sortBy === $state.params.sortBy;
    }

    function isDesc() {
      return $state.params.order === "desc";
    }

    function pageSizeChanged() {
      $state.go('.', {
        pageSize: vm.pageSize
      });
    }

    function sortByChanged(sortBy) {
      $state.go('.', {
        order: $state.params.sortBy != sortBy ? "asc" :
          $state.params.order === "asc" ? "desc" : "asc",
        sortBy: sortBy
      });
    }

    function activate() {
      $scope.$watchGroup(["userRolesCtl.stateParams.order",
                          "userRolesCtl.stateParams.sortBy",
                          "userRolesCtl.stateParams.substr"], _.debounce(function () {
                            $scope.$broadcast("reloadRolesPoller");
                          }, 500, {leading: true}));

      $scope.$watch('userRolesCtl.filterField', _.debounce(function () {
        $state.go('.', {
          substr: vm.filterField || undefined
        })
      }, 500, {leading: true}), true);

      mnHelper.initializeDetailsHashObserver(vm, 'openedUsers', '.');

      mnPromiseHelper(vm, mnUserRolesService.getRoles())
        .applyToScope(function (roles) {
          mnPromiseHelper(vm, mnUserRolesService.getRolesByRole(roles))
            .applyToScope("rolesByRole");
        });

      var poller = new mnPoller($scope, function () {
        return mnUserRolesService.getState($state.params);
      })
          .subscribe("state", vm)
          .setInterval(10000)
          .reloadOnScopeEvent("reloadRolesPoller")
          .cycle();
    }

    function editUser(user) {
      $uibModal.open({
        templateUrl: 'app/mn_admin/mn_security/mn_user_roles/add_dialog/mn_user_roles_add_dialog.html',
        controller: 'mnUserRolesAddDialogController as userRolesAddDialogCtl',
        resolve: {
          user: mnHelper.wrapInFunction(user),
          isLdapEnabled: mnHelper.wrapInFunction(poolDefault.saslauthdEnabled)
        }
      });
    }
    function addUser() {
      $uibModal.open({
        templateUrl: 'app/mn_admin/mn_security/mn_user_roles/add_dialog/mn_user_roles_add_dialog.html',
        controller: 'mnUserRolesAddDialogController as userRolesAddDialogCtl',
        resolve: {
          user: mnHelper.wrapInFunction(undefined),
          isLdapEnabled: mnHelper.wrapInFunction(poolDefault.saslauthdEnabled)
        }
      });
    }

    function addLDAP() {
      $uibModal.open({
        templateUrl: 'app/mn_admin/mn_security/mn_user_roles/mn_add_ldap_dialog.html',
        controller: 'mnAddLDAPDialogController as addLdapDialogCtl'
      });
    }

    function resetUserPassword(user) {
      $uibModal.open({
        templateUrl: 'app/mn_admin/mn_security/mn_user_roles/reset_password_dialog/mn_user_roles_reset_password_dialog.html',
        controller: 'mnUserRolesResetPasswordDialogController as userRolesResetPasswordDialogCtl',
        resolve: {
          user: mnHelper.wrapInFunction(user)
        }
      });
    }
    function deleteUser(user) {
      $uibModal.open({
        templateUrl: 'app/mn_admin/mn_security/mn_user_roles/delete_dialog/mn_user_roles_delete_dialog.html',
        controller: 'mnUserRolesDeleteDialogController as userRolesDeleteDialogCtl',
        resolve: {
          user: mnHelper.wrapInFunction(user)
        }
      });
    }
  }
})();
