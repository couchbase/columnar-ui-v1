/*
Copyright 2020-Present Couchbase, Inc.

Use of this software is governed by the Business Source License included in
the file licenses/BSL-Couchbase.txt.  As of the Change Date specified in that
file, in accordance with the Business Source License, use of this software will
be governed by the Apache License, Version 2.0, included in the file
licenses/APL2.txt.
*/

import angular from "angular";
import _ from "lodash";
import uiBootstrap from "angular-ui-bootstrap";

import mnPoolDefault from "../components/mn_pool_default.js";
import template from "./mn_servers_stop_rebalance_dialog.html";

export default "mnServersService";

angular
  .module('mnServersService', [mnPoolDefault, uiBootstrap])
  .factory('mnServersService', ["$http", "$q", "$uibModal", "mnPoolDefault", mnServersFactory]);

function mnServersFactory($http, $q, $uibModal, mnPoolDefault) {
  var pendingEject = [];

  var mnServersService = {
    addToPendingEject: addToPendingEject,
    removeFromPendingEject: removeFromPendingEject,
    getPendingEject: getPendingEject,
    setPendingEject: setPendingEject,
    reAddNode: reAddNode,
    setupServices: setupServices,
    modifyServices: modifyServices,
    cancelFailOverNode: cancelFailOverNode,
    stopRebalance: stopRebalance,
    stopRebalanceWithConfirm: stopRebalanceWithConfirm,
    stopRecovery: stopRecovery,
    postFailover: postFailover,
    ejectNode: ejectNode,
    postRebalance: postRebalance,
    getNodeStatuses: getNodeStatuses,
    addNodesByStatus: addNodesByStatus,
    getNodes: getNodes,
    addServer: addServer,
    getServicesStatus: getServicesStatus
  };

  return mnServersService;

  function stopRebalanceWithConfirm() {
    return stopRebalance()
      .then(null, function (resp) {
        if (resp.status === 504) {
          return $uibModal.open({
            template
          }).result.then(function () {
            return stopRebalance(true);
          });
        }
      });
  }

  function getNodesByService(service, nodes) {
    var nodes2 = nodes.allNodes.filter(node => node.services.indexOf(service) > -1);
    return addNodesByStatus(nodes2);
  }

  function getServicesStatus(isEnterprise) {
    return mnServersService.getNodes().then(function (nodes) {
      var rv = {
        kv: getNodesByService("kv", nodes),
        index: getNodesByService("index", nodes),
        n1ql: getNodesByService("n1ql", nodes),
        fts: getNodesByService("fts", nodes),
        all: nodes
      };
      if (true) {
        rv.cbas = getNodesByService("cbas", nodes);
        rv.eventing = getNodesByService("eventing", nodes);
        rv.backup = getNodesByService("backup", nodes);
      }
      return rv;
    });
  }

  function addToPendingEject(node) {
    pendingEject.push(node);
  }
  function removeFromPendingEject(node) {
    node.pendingEject = false;
    _.remove(pendingEject, {'hostname': node.hostname});
  }
  function getPendingEject() {
    return pendingEject;
  }
  function setPendingEject(newPendingEject) {
    pendingEject = newPendingEject;
  }
  function reAddNode(data) {
    return $http({
      method: 'POST',
      url: '/controller/setRecoveryType',
      data: data
    });
  }
  function setupServices(data) {
    return $http({
      method: 'POST',
      url: '/node/controller/setupServices',
      data: data
    });
  }
  function cancelFailOverNode(data) {
    return $http({
      method: 'POST',
      url: '/controller/reFailOver',
      data: data
    });
  }
  function stopRebalance(allowUnsafe) {
    return $http({
      method: 'POST',
      url: '/controller/stopRebalance',
      data: "allowUnsafe=" + (allowUnsafe ? "true" : "false")
    });
  }
  function stopRecovery(url) {
    return $http({
      method: 'POST',
      url: url
    });
  }
  function postFailover(type, otpNode, allowUnsafe) {
    var data = "";
    if (_.isArray(otpNode)) {
      data = otpNode.map(function (node) {
        return "otpNode=" + encodeURIComponent(node);
      }).join("&");
    } else {
      data = "otpNode=" + encodeURIComponent(otpNode);
    }

    data += "&allowUnsafe=" + (allowUnsafe ? "true" : "false");

    return $http({
      method: 'POST',
      url: '/controller/' + type,
      data: data
    });
  }
  function ejectNode(data) {
    return $http({
      method: 'POST',
      url: '/controller/ejectNode',
      data: data
    });
  }
  function postRebalance(allNodes) {
    return $http({
      method: 'POST',
      url: '/controller/rebalance',
      data: {
        knownNodes: _.pluck(allNodes, 'otpNode').join(','),
        ejectedNodes: _.pluck(mnServersService.getPendingEject(), 'otpNode').join(',')
      }
    }).then(null, function (resp) {
      if (resp.data) {
        if (resp.data.mismatch) {
          resp.data.mismatch = "Could not Rebalance because the cluster configuration was modified by someone else.\nYou may want to verify the latest cluster configuration and, if necessary, please retry a Rebalance.";
        }
        if (resp.data.deltaRecoveryNotPossible) {
          resp.data.deltaRecoveryNotPossible = "Delta recovery is not possible. This could be because a node was added, server groups or bucket configurations were changed or a failover may have finished in a way that prevents delta recovery. Please rebalance using full recovery.";
        }
        if (resp.data.noKVNodesLeft) {
          resp.data.noKVNodesLeft = "Could not Rebalance out last kv node(s).";
        }
      } else {
        resp.data = "Request failed. Check logs.";
      }
      return $q.reject(resp);
    });
  }
  function addStatusMessagePart(status, message) {
    if (status.length) {
      return status + ", " + message;
    } else {
      return status + message;
    }
  }
  function getStatusWeight(status) {
    var priority = {
      unhealthy: 0,
      inactiveFailed: 1,
      warmup: 2,
      healthy: 3,
    };
    return priority[status] === undefined ? 100 : priority[status];
  }
  function addNodesByStatus(nodes) {
    var nodesByStatuses = {};
    var statusClass = "inactive";

    _.forEach(nodes, function (node) {
      var status = "";

      if (node.clusterMembership === 'inactiveFailed') {
        status = addStatusMessagePart(status, "failed over");
      }
      if (node.status === 'unhealthy') {
        status = addStatusMessagePart(status, "not responding");
      }
      if (node.status === 'warmup') {
        status = addStatusMessagePart(status, "pending");
      }
      if (status != "") {
        nodesByStatuses[status] = ++nodesByStatuses[status] || 1;
      }
      if (getStatusWeight(statusClass) > getStatusWeight(node.status)) {
        statusClass = node.status;
      }
      if (getStatusWeight(statusClass) > getStatusWeight(node.clusterMembership)) {
        statusClass = node.clusterMembership;
      }
    });


    nodes.nodesByStatuses = nodesByStatuses;
    nodes.statusClass = statusClass;

    return nodes;
  }
  function getNodeStatuses(hostname) {
    return $http({
      method: 'GET',
      url: '/nodeStatuses'
    }).then(function (resp) {
      var nodeStatuses = resp.data;
      var node = nodeStatuses[hostname];
      if (!node) {
        return
      }
      var rv = _.clone(node);
      rv.confirmation = false;
      rv.down = node.status != 'healthy';
      rv.backfill = node.replication < 1;
      rv.gracefulFailoverPossible = false; //node.gracefulFailoverPossible;
      rv.failOver = rv.down ? "startFailover" : rv.gracefulFailoverPossible ? "startGracefulFailover" : "startFailover";
      !rv.backfill && (rv.confirmation = true);
      return rv;
    })
  }
  function getNodes() {
    return mnPoolDefault.get().then(function (poolDefault) {
      var nodes = poolDefault.nodes;

      var stillActualEject = [];

      _.each(mnServersService.getPendingEject(), function (node) {
        var original = _.detect(nodes, function (n) {
          return n.otpNode == node.otpNode;
        });
        if (!original || original.clusterMembership === 'inactiveAdded') {
          return;
        }
        stillActualEject.push(original);
        original.pendingEject = true;
      });

      mnServersService.setPendingEject(stillActualEject);

      var rv = {};

      rv.allNodes = nodes;

      rv.failedOver = _.filter(nodes, function (node) {
        return node.clusterMembership === 'inactiveFailed';
      });
      rv.onlyActive = _.filter(nodes, function (node) {
        return node.clusterMembership === 'active';
      });
      rv.active = rv.failedOver.concat(rv.onlyActive);
      rv.down = _.filter(nodes, function (node) {
        return node.status !== 'healthy';
      });
      rv.pending = _.filter(nodes, function (node) {
        return node.clusterMembership !== 'active';
      }).concat(mnServersService.getPendingEject());
      rv.reallyActive = _.filter(rv.onlyActive, function (node) {
        return !node.pendingEject
      });
      rv.reallyActiveData = _.filter(rv.reallyActive, function (node) {
        return _.indexOf(node.services, "kv") > -1;
      });
      rv.unhealthyActive = _.detect(rv.reallyActive, function (node) {
        return node.status === 'unhealthy';
      });
      let ram = poolDefault.storageTotals.ram;

      rv.ramTotalPerActiveNode = ram ? (ram.total / rv.onlyActive.length) : 0;

      return rv;
    });
  }
  function addServer(selectedGroup, credentials, servicesList) {
    credentials = _.clone(credentials);
    if (!credentials['user'] || !credentials['password']) {
      credentials['user'] = '';
      credentials['password'] = '';
    }
    credentials.services = '';
    if (servicesList.length) {
      credentials.services = servicesList.join(',');
    }
    return $http({
      method: 'POST',
      url: (selectedGroup && selectedGroup.addNodeURI) || '/controller/addNode',
      data: credentials
    });
  }
  function modifyServices(config) {
    return $http({
      method: 'POST',
      url: '/controller/rebalance',
      data: config,
    });
  }
}
