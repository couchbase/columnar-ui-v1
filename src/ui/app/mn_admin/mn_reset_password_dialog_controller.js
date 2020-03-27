import angular from "/ui/web_modules/angular.js";
import mnFilters from "/ui/app/components/mn_filters.js";
import mnEqual from "/ui/app/components/directives/mn_validation/mn_equal.js";

import mnAuthService from "/ui/app/mn_auth/mn_auth_service.js";
import mnResetPasswordDialogService from "./mn_reset_password_dialog_service.js"

export default "mnResetPasswordDialog";

angular
  .module("mnResetPasswordDialog", [
    mnFilters,
    mnEqual,
    mnAuthService,
    mnResetPasswordDialogService
  ])
  .controller("mnResetPasswordDialogController", mnResetPasswordDialogController);

function mnResetPasswordDialogController(mnResetPasswordDialogService, mnPromiseHelper, mnAuthService, user) {
  var vm = this;
  vm.submit = submit;
  vm.user = {
    name: user.id
  };

  function submit() {
    if (vm.form.$invalid) {
      return;
    }
    var promise = mnResetPasswordDialogService.post(vm.user);

    mnPromiseHelper(vm, promise)
      .showGlobalSpinner()
      .catchErrors()
      .onSuccess(function () {
        return mnAuthService.logout();
      });
  }
}
