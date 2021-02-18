import angular from "/ui/web_modules/angular.js";
import _ from "/ui/web_modules/lodash.js";
import uiSelect from "/ui/web_modules/ui-select.js";

import mnHelper from "/ui/app/components/mn_helper.js";
import mnPromiseHelper from "/ui/app/components/mn_promise_helper.js";
import mnPoll from "/ui/app/components/mn_poll.js";
import mnCompaction from "/ui/app/components/mn_compaction.js";
import mnPoolDefault from "/ui/app/components/mn_pool_default.js";
import mnSortableTable from "/ui/app/components/directives/mn_sortable_table.js";
import mnSpinner from "/ui/app/components/directives/mn_spinner.js";
import mnEqual from "/ui/app/components/directives/mn_validation/mn_equal.js";
import mnFilters from "/ui/app/components/mn_filters.js";
import mnAutocompleteOff from "/ui/app/components/directives/mn_autocomplete_off.js";
import mnFocus from "/ui/app/components/directives/mn_focus.js";
import mnUserRolesSelect from "/ui/app/components/directives/mn_user_roles_select_controller.js";
import mnFileReader from "/ui/app/components/mn_file_reader.js";
import mnSearch from "/ui/app/components/directives/mn_search/mn_search_directive.js";

import mnUserRolesService from "./mn_user_roles_service.js";
import mnAddLDAPDialogController from "./mn_add_ldap_dialog_controller.js";
import mnUserRolesAddDialogController from "./mn_user_roles_add_dialog_controller.js";
import mnUserRolesDeleteDialogController from "./mn_user_roles_delete_dialog_controller.js";
import mnUserRolesResetPasswordDialogController from "./mn_user_roles_reset_password_dialog_controller.js";

import mnRolesController from "./mn_roles_controller.js";

export default "mnUserRoles";

angular
  .module("mnUserRoles", [
    uiSelect,
    mnHelper,
    mnPromiseHelper,
    mnPoll,
    mnSortableTable,
    mnSpinner,
    mnEqual,
    mnFilters,
    mnAutocompleteOff,
    mnFocus,
    mnUserRolesService,
    mnUserRolesSelect,
    mnFileReader,
    mnSearch
  ])
  .controller("mnUserRolesController", mnUserRolesController)
  .controller("mnAddLDAPDialogController", mnAddLDAPDialogController)
  .controller("mnUserRolesDeleteDialogController", mnUserRolesDeleteDialogController)
  .controller("mnUserRolesResetPasswordDialogController", mnUserRolesResetPasswordDialogController)
  .controller("mnUserRolesAddDialogController", mnUserRolesAddDialogController)
  .controller("mnRolesController", mnRolesController);

function mnUserRolesController($scope, $uibModal, mnPromiseHelper, mnUserRolesService, mnPoller, mnHelper, $state, poolDefault, permissions) {
  var vm = this;

  vm.deleteUser = deleteUser;
  vm.editUser = editUser;
  vm.resetUserPassword = resetUserPassword;

  vm.filterField = "";

  vm.stateParams = $state.params;

  vm.pageSize = $state.params.pageSize;
  vm.pageSizeChanged = pageSizeChanged;
  vm.parseGroupNames = parseGroupNames;
  vm.sortByChanged = sortByChanged;
  vm.isOrderBy = isOrderBy;
  vm.isDesc = isDesc;
  vm.getRoleParams = getRoleParams;

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

  function parseGroupNames(group) {
    return _.uniq(group.groups.concat(group.external_groups)).join(", ");
  }

  function sortByChanged(sortBy) {
    $state.go('.', {
      order: $state.params.sortBy != sortBy ? "asc" :
        $state.params.order === "asc" ? "desc" : "asc",
      sortBy: sortBy
    });
  }

  function getRoleParams(role) {
    return mnUserRolesService.getRoleParams(vm.rolesByRole, role);
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

    mnUserRolesService.getRoles().then(roles => {
      vm.rolesByRole = roles.rolesByRole;
    });

    if (poolDefault.saslauthdEnabled) {
      mnPromiseHelper(vm, mnUserRolesService.getSaslauthdAuth())
        .applyToScope("saslauthdAuth");
    }


    if (permissions.cluster.admin.security.external.read &&
        poolDefault.compat.atLeast65 && poolDefault.isEnterprise) {
      new mnPoller($scope, function () {
        return mnUserRolesService.getLdapSettings();
      })
        .subscribe("ldapSettings", vm)
        .setInterval(10000)
        .reloadOnScopeEvent("reloadLdapSettings")
        .cycle();
    }

    new mnPoller($scope, function () {
      return mnUserRolesService.getState($state.params);
    })
      .subscribe("state", vm)
      .setInterval(10000)
      .reloadOnScopeEvent("reloadRolesPoller")
      .cycle();
  }

  function editUser(user) {
    $uibModal.open({
      templateUrl: 'app/mn_admin/mn_user_roles_add_dialog.html',
      controller: 'mnUserRolesAddDialogController as userRolesAddDialogCtl',
      resolve: {
        user: mnHelper.wrapInFunction(user),
        isSaslauthdAuthEnabled: function () {
          return (vm.saslauthdAuth && vm.saslauthdAuth.enabled);
        },
        isLdapEnabled: function () {
          return (vm.ldapSettings && vm.ldapSettings.data.authenticationEnabled);
        }
      }
    });
  }
  function resetUserPassword(user) {
    $uibModal.open({
      templateUrl: 'app/mn_admin/mn_user_roles_reset_password_dialog.html',
      controller: 'mnUserRolesResetPasswordDialogController as userRolesResetPasswordDialogCtl',
      resolve: {
        user: mnHelper.wrapInFunction(user)
      }
    });
  }
  function deleteUser(user) {
    $uibModal.open({
      templateUrl: 'app/mn_admin/mn_user_roles_delete_dialog.html',
      controller: 'mnUserRolesDeleteDialogController as userRolesDeleteDialogCtl',
      resolve: {
        user: mnHelper.wrapInFunction(user)
      }
    });
  }
}
