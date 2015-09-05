angular.module('mnHelper', [
  'ui.router',
  'mnTasksDetails',
  'mnAlertsService',
  'mnHttp'
]).factory('mnHelper',
  function ($window, $state, $stateParams, $location, $timeout, $q, mnTasksDetails, mnAlertsService, mnHttp) {
    var mnHelper = {};

    mnHelper.wrapInFunction = function (value) {
      return function () {
        return value;
      };
    };

    mnHelper.calculateMaxMemorySize = function (totalRAMMegs) {
      return Math.floor(Math.max(totalRAMMegs * 0.8, totalRAMMegs - 1024));
    };

    mnHelper.initializeDetailsHashObserver = function ($scope, hashKey, stateName) {
      function getHashValue() {
        return $stateParams[hashKey] || [];
      }
      $scope.isDetailsOpened = function (hashValue) {
        return _.contains(getHashValue(), String(hashValue));
      };
      $scope.toggleDetails = function (hashValue) {
        var currentlyOpened = getHashValue();
        var stateParams = {};
        if ($scope.isDetailsOpened(hashValue)) {
          stateParams[hashKey] = _.difference(currentlyOpened, [String(hashValue)]);
          $state.go(stateName, stateParams, {notify: false});
        } else {
          currentlyOpened.push(String(hashValue));
          stateParams[hashKey] = currentlyOpened;
          $state.go(stateName, stateParams, {notify: false});
        }
      };
    };

    mnHelper.checkboxesToList = function (object) {
      return _.chain(object).pick(angular.identity).keys().value();
    };

    mnHelper.reloadApp = function () {
      $window.location.reload();
    };

    mnHelper.reloadState = function () {
      $state.transitionTo($state.current, $stateParams, {reload: true, inherit: true, notify: true});
    };

    return mnHelper;
  });
