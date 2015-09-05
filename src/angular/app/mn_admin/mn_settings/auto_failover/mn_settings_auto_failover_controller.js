angular.module('mnSettingsAutoFailover', [
  'mnSettingsAutoFailoverService',
  'mnHelper',
  'mnPromiseHelper'
]).controller('mnSettingsAutoFailoverController',
  function ($scope, mnHelper, mnPromiseHelper, mnSettingsAutoFailoverService) {
    mnPromiseHelper($scope, mnSettingsAutoFailoverService.getAutoFailoverSettings()).applyToScope(function (autoFailoverSettings) {
      $scope.state = autoFailoverSettings.data
    });
    $scope.submit = function () {
      var data = {
        enabled: $scope.state.enabled,
        timeout: $scope.state.timeout
      };
      mnPromiseHelper($scope, mnSettingsAutoFailoverService.saveAutoFailoverSettings(data))
        .showErrorsSensitiveSpinner()
        .catchGlobalErrors('An error occured, auto-failover settings were not saved.')
        .reloadState();
    };
  });
