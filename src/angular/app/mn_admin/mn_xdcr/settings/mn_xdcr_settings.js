angular.module('mnXDCR').directive('mnXdcrSettings', function (mnHttp, mnPromiseHelper) {

  return {
    restrict: 'A',
    scope: {
      settings: '=mnXdcrSettings'
    },
    isolate: false,
    replace: true,
    templateUrl: 'mn_admin/mn_xdcr/settings/mn_xdcr_settings.html',
    controller: function ($scope) {
      $scope.whenGoxdcrEnabled = true; //this flag is a fake, should be replaced in near future
      $scope.$watch('settings', function (settings) {
        mnPromiseHelper($scope, mnHttp({
          method: 'POST',
          url: '/settings/replications/',
          data: settings,
          params: {
            just_validate: 1
          }
        })).catchErrors().cancelOnScopeDestroy();
      }, true);
    }
  };
});