(function () {
  "use strict";

  angular.module('mnLogsCollectInfoService', [
    'mnServersService',
    'mnTasksDetails',
    'mnFilters',
    'mnSettingsClusterService',
    'mnPoolDefault',
    'mnHelper'
  ]).service('mnLogsCollectInfoService', mnLogsCollectInfoServiceFactory);

  function mnLogsCollectInfoServiceFactory($http, $q, mnServersService, mnTasksDetails, mnStripPortHTMLFilter, mnSettingsClusterService, mnPoolDefault, mnHelper) {
    var mnLogsCollectInfoService = {
      startLogsCollection: startLogsCollection,
      cancelLogsCollection: cancelLogsCollection,
      getState: getState
    };

    return mnLogsCollectInfoService;

    function startLogsCollection(collect) {
      var data = {};
      data.nodes = !collect.from ? mnHelper.checkboxesToList(collect.nodes).join(',') : '*';
      if (collect.upload) {
        data.uploadHost = collect.uploadHost;
        data.customer = collect.customer;
        data.ticket = collect.ticket;
        if (collect.uploadProxy) {
          data.uploadProxy = collect.uploadProxy;
        }
      }
      if (collect.enableLogDir) {
        data.logDir = collect.logDir;
      }
      if (collect.enableTmpDir) {
        data.tmpDir = collect.tmpDir;
      }
      return $http.post('/controller/startLogsCollection', data);
    }
    function cancelLogsCollection() {
      return $http.post('/controller/cancelLogsCollection');
    }
    function getState() {
      var queries = [
        mnServersService.getNodes(),
        mnTasksDetails.get()
      ];
      if (mnPoolDefault.export.compat.atLeast55 && mnPoolDefault.export.isEnterprise) {
        queries.push(mnSettingsClusterService.getLogRedaction());
      }
      return $q.all(queries).then(function (resp) {
        var nodes = resp[0].allNodes;
        var tasks = resp[1].tasks;
        var logRedaction = resp[2];
        var task = _.detect(tasks, function (taskInfo) {
          return taskInfo.type === "clusterLogsCollection";
        });
        if (!task) {
          return {
            nodesByStatus: {},
            nodeErrors: [],
            status: 'idle',
            perNode: {},
            nodes: nodes,
            logRedactionLevel: logRedaction && logRedaction.logRedactionLevel
          };
        }

        task = JSON.parse(JSON.stringify(task));

        var perNodeHash = task.perNode;
        var perNode = [];

        var cancallable = "starting started startingUpload startedUpload".split(" ");

        _.each(perNodeHash, function (ni, nodeName) {
          var node = _.detect(nodes, function (n) {
            return n.otpNode === nodeName;
          });

          ni.nodeName = (node === undefined) ? nodeName.replace(/^.*?@/, '') : mnStripPortHTMLFilter(node.hostname, nodes);
          perNode.push(ni);
          // possible per-node statuses are:
          //      starting, started, failed, collected,
          //      startingUpload, startedUpload, failedUpload, uploaded

          if (task.status == 'cancelled' && cancallable.indexOf(ni.status) >= 0) {
            ni.status = 'cancelled';
          }
        });

        var nodesByStatus = _.groupBy(perNode, 'status');

        var nodeErrors = _.compact(_.map(perNode, function (ni) {
          if (ni.uploadOutput) {
            return {nodeName: ni.nodeName, error: ni.uploadOutput};
          }
        }));

        task.nodesByStatus = nodesByStatus;
        task.nodeErrors = nodeErrors;
        task.logRedactionLevel = logRedaction && logRedaction.logRedactionLevel;
        task.nodes = nodes;

        return task
      });
    }
  }
})();
