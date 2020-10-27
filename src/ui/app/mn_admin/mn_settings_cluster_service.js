import angular from "/ui/web_modules/angular.js";
import mnPools from "/ui/app/components/mn_pools.js";
import mnPoolDefault from "/ui/app/components/mn_pool_default.js";

export default "mnSettingsClusterService";

angular
  .module('mnSettingsClusterService', [mnPools, mnPoolDefault])
  .factory('mnSettingsClusterService', mnSettingsClusterServiceFactory);

function mnSettingsClusterServiceFactory($http, $q, IEC, mnPools, mnPoolDefault) {
  var mnSettingsClusterService = {
    postPoolsDefault: postPoolsDefault,
    getIndexSettings: getIndexSettings,
    postIndexSettings: postIndexSettings,
    registerSubmitCallback: registerSubmitCallback,
    clearSubmitCallbacks: clearSubmitCallbacks,
    getSubmitCallbacks: getSubmitCallbacks,
    getSettingsRetryRebalance: getSettingsRetryRebalance,
    postSettingsRetryRebalance: postSettingsRetryRebalance,
    getSettingsRebalance: getSettingsRebalance,
    postSettingsRebalance: postSettingsRebalance,
    getPendingRetryRebalance: getPendingRetryRebalance,
    postCancelRebalanceRetry: postCancelRebalanceRetry,
    getMemcachedSettings: getMemcachedSettings,
    postMemcachedSettings: postMemcachedSettings
  };

  var childSubmitCallbacks = [];

  return mnSettingsClusterService;

  function postSettingsRetryRebalance(data, params) {
    return $http.post("/settings/retryRebalance", data, {params: params});
  }

  function getSettingsRebalance() {
    return $http.get("/settings/rebalance");
  }

  function postSettingsRebalance(data) {
    return $http.post("/settings/rebalance", data);
  }

  function getMemcachedSettings() {
    return $http.get("/pools/default/settings/memcached/global");
  }

  function postMemcachedSettings(data) {
    return $http.post("/pools/default/settings/memcached/global", data);
  }

  function getPendingRetryRebalance(mnHttpParams) {
    return $http({
      url: "/pools/default/pendingRetryRebalance",
      method: 'GET',
      mnHttp: mnHttpParams
    });
  }

  function getSettingsRetryRebalance() {
    return $http.get("/settings/retryRebalance")
      .then(function (resp) {
        return resp.data;
      });
  }

  function postCancelRebalanceRetry(replicationId) {
    return $http({
      url: "/controller/cancelRebalanceRetry/" + encodeURIComponent(replicationId),
      method: "POST",
      mnHttp: {group: "global"}
    });
  }

  function getSubmitCallbacks() {
    return childSubmitCallbacks;
  }

  function clearSubmitCallbacks (cb) {
    childSubmitCallbacks = [];
  }

  function registerSubmitCallback(cb) {
    childSubmitCallbacks.push(cb);
  }

  function maybeSetQuota(data, memory, service, key) {
    if (!memory.services || memory.services.model[service]) {
      if (memory[key] === null) {
        data[key] = "";
      } else {
        data[key] = memory[key];
      }
    }
  }

  function postPoolsDefault(memoryQuotaConfig, justValidate, clusterName) {
    var data = {};

    if (clusterName !== undefined) {
      data.clusterName = clusterName;
    }

    if (memoryQuotaConfig) {
      maybeSetQuota(data, memoryQuotaConfig, "kv", "memoryQuota");
      maybeSetQuota(data, memoryQuotaConfig, "index", "indexMemoryQuota");
      maybeSetQuota(data, memoryQuotaConfig, "fts", "ftsMemoryQuota");
      if (mnPools.export.isEnterprise) {
        maybeSetQuota(data, memoryQuotaConfig, "cbas", "cbasMemoryQuota");
        maybeSetQuota(data, memoryQuotaConfig, "eventing", "eventingMemoryQuota");
      }
    }

    var config = {
      method: 'POST',
      url: '/pools/default',
      data: data
    };
    if (justValidate) {
      config.params = {
        just_validate: 1
      };
    }
    return $http(config);
  }
  function getIndexSettings() {
    return $http.get("/settings/indexes").then(function (resp) {
      return resp.data;
    });
  }
  function postIndexSettings(data, justValidate) {
    var configData = {};
    let fields = ["indexerThreads", "logLevel", "maxRollbackPoints", "storageMode"];

    if (mnPoolDefault.export.compat.atLeast70) {
      fields.push("redistributeIndexes");
    }

    fields
      .forEach(function (name) {
        if (data[name] !== undefined) {
          configData[name] = data[name];
        }
      });
    var config = {
      method: 'POST',
      url: '/settings/indexes',
      data: configData
    };
    if (justValidate) {
      config.params = {
        just_validate: 1
      };
    }
    return $http(config);
  }
}
