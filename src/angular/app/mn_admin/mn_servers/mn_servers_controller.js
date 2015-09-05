angular.module('mnServers', [
  'mnPoolDefault',
  'ui.router',
  'ui.bootstrap',
  'mnServersService',
  'mnHelper',
  'mnVerticalBar',
  'mnBarUsage',
  'mnServersListItemDetailsService',
  'mnFilters',
  'mnSortableTable',
  'mnServices',
  'mnMemoryQuotaService',
  'mnIndexesService',
  'mnPromiseHelper',
  'mnGroupsService',
  'mnPoll'
]).controller('mnServersController',
  function ($scope, $state, $modal, $q, $interval, mnMemoryQuotaService, mnIndexesService, $stateParams, $timeout, mnPoolDefault, mnPoll, mnServersService, mnHelper, mnGroupsService) {

    mnPoll.start($scope, function () {
      return mnServersService.getServersState($stateParams.list);
    }).subscribe("mnServersState").keepIn();

    $scope.addServer = function () {
      $modal.open({
        templateUrl: 'mn_admin/mn_servers/add_dialog/mn_servers_add_dialog.html',
        controller: 'mnServersAddDialogController',
        resolve: {
          groups: function () {
            return mnPoolDefault.get().then(function (poolDefault) {
              if (poolDefault.isGroupsAvailable) {
                return mnGroupsService.getGroups();
              }
            });
          }
        }
      });
    };
    $scope.postRebalance = function () {
      mnServersService.postRebalance($scope.mnServersState.allNodes).then(function () {
        $state.go('app.admin.servers', {list: 'active'});
        $scope.viewLoading = true;
        mnHelper.reloadState();
      });
    };
    $scope.onStopRecovery = function () {
      mnServersService.stopRecovery($scope.tasks.tasksRecovery.stopURI).then(mnHelper.reloadState)
    };
    $scope.stopRebalance = function () {
      var request = mnServersService.stopRebalance().then(
        mnHelper.reloadState,
        function (reps) {
          (reps.status === 400) && $modal.open({
            templateUrl: 'mn_admin/mn_servers/stop_rebalance_dialog/mn_servers_stop_rebalance_dialog.html',
            controller: 'mnServersStopRebalanceDialogController'
          });
      });
    };

    mnHelper.initializeDetailsHashObserver($scope, 'openedServers', 'app.admin.servers');

    $scope.ejectServer = function (node) {
      if (node.isNodeInactiveAdded) {
        $scope.viewLoading = true;
        mnServersService.ejectNode({otpNode: node.otpNode});
        mnHelper.reloadState();
        return;
      }

      $q.all([
        mnIndexesService.getIndexesState(),
        mnServersService.getNodes()
      ]).then(function (resp) {
        var nodes = resp[1];
        var indexStatus = resp[0];
        var warnings = {
          isLastIndex: mnMemoryQuotaService.isOnlyOneNodeWithService(nodes.allNodes, node.services, 'index'),
          isLastQuery: mnMemoryQuotaService.isOnlyOneNodeWithService(nodes.allNodes, node.services, 'n1ql'),
          isThereIndex: !!_.find(indexStatus.indexes, function (index) {
            return _.indexOf(index.hosts, node.hostname) > -1;
          }),
          isKv: _.indexOf(node.services, 'kv') > -1
        };
        if (_.some(_.values(warnings))) {
          $modal.open({
            templateUrl: 'mn_admin/mn_servers/eject_dialog/mn_servers_eject_dialog.html',
            controller: 'mnServersEjectDialogController',
            resolve: {
              warnings: function () {
                return warnings;
              },
              node: function () {
                return node;
              }
            }
          });
        } else {
          mnServersService.addToPendingEject(node);
          $scope.viewLoading = true;
          mnHelper.reloadState();
        }
      });
    };
    $scope.failOverNode = function (node) {
      $modal.open({
        templateUrl: 'mn_admin/mn_servers/failover_dialog/mn_servers_failover_dialog.html',
        controller: 'mnServersFailOverDialogController',
        resolve: {
          node: function () {
            return node;
          }
        }
      });
    };
    $scope.reAddNode = function (type, otpNode) {
      mnServersService.reAddNode({
        otpNode: otpNode,
        recoveryType: type
      }).then(mnHelper.reloadState);
    };
    $scope.cancelFailOverNode = function (otpNode) {
      mnServersService.cancelFailOverNode({
        otpNode: otpNode
      }).then(mnHelper.reloadState);
    };
    $scope.cancelEjectServer = function (node) {
      mnServersService.removeFromPendingEject(node);
      mnHelper.reloadState();
    };

  });