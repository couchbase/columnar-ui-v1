/*
Copyright 2020-Present Couchbase, Inc.

Use of this software is governed by the Business Source License included in
the file licenses/BSL-Couchbase.txt.  As of the Change Date specified in that
file, in accordance with the Business Source License, use of this software will
be governed by the Apache License, Version 2.0, included in the file
licenses/APL2.txt.
*/

import angular from "angular";
import {BehaviorSubject} from 'rxjs';

import mnPoolDefault from "../components/mn_pool_default.js";
import mnStoreService from "../components/mn_store_service.js";
import mnStatisticsNewService from "./mn_statistics_service.js";
import mnStatsDesc from "./mn_statistics_description.js";

export default "mnUserRolesService";

angular
  .module("mnUserRolesService", [mnPoolDefault, mnStoreService, mnStatisticsNewService])
  .factory("mnUserRolesService", ["$q", "$http", "mnPoolDefault", "mnStoreService", "mnStatisticsNewService", mnUserRolesFactory]);

function mnUserRolesFactory($q, $http, mnPoolDefault, mnStoreService, mnStatisticsNewService) {
  // Service roles and direct privileges are the engine's own, not ns_server's:
  // they are granted with SQL++ and live in the service's metadata, so they are
  // read with a query rather than from /settings/rbac. Only USER grantees
  // matter here - a grant to another role belongs on the Service RBAC tab,
  // which is where these are administered.
  //
  // Both halves come back in one statement because this rides the poller: two
  // reads would double what the users page costs the service every tick. A row
  // with a RoleName is an assignment, a row without is a privilege.
  //
  // Ownership is excluded. The engine records it for every object its owner
  // created, so counting it would report thousands of "direct privileges"
  // against whoever built the databases, none of them granted by anyone.
  //
  // Id is the account the grant was made to. It is not the same question as the
  // name it was made under: delete a user, create another of that name, and the
  // rows left behind still say the old account and grant nothing.
  var ANALYTICS_GRANTS_QUERY =
      "SELECT a.Assignee AS Grantee, a.AssigneeDomain AS Domain, a.AssigneeId AS Id, " +
      "a.AssignedRoleName AS RoleName " +
      "FROM Metadata.`AssignedRole` AS a WHERE a.GranteeType = 'USER' " +
      "UNION ALL " +
      // Every column aliased, including the ones whose names look right
      // already: SQL++ does not rename a UNION ALL branch positionally, so
      // without these the privilege half comes back as GranteeDomain and
      // GranteeUuid and the two halves are read with different keys.
      "SELECT p.Grantee AS Grantee, p.GranteeDomain AS Domain, p.GranteeUuid AS Id, " +
      "NULL AS RoleName " +
      "FROM Metadata.`Privilege` AS p " +
      "WHERE p.GranteeType = 'USER' AND p.Privilege != 'OWNERSHIP'";

  // What each built-in service role allows, in the engine's own hierarchy:
  // sys_root contains sys_data_admin and sys_security_admin, sys_data_admin
  // contains sys_data_reader, and sys_data_reader contains sys_view_reader.
  // A role the engine did not create has no description to give.
  var BUILT_IN_ROLES = {
    sys_root: {
      name: "Service Root",
      includes: ["sys_data_admin", "sys_security_admin"],
      description: "Full control: everything Service Data Admin and Service RBAC Admin allow, " +
        "plus the service's own diagnostic functions, which no other role can run."
    },
    sys_security_admin: {
      name: "Service RBAC Admin",
      description: "Create and drop service roles, and grant and revoke privileges. " +
        "Cannot grant Service Root, which needs a platform role that can manage this " +
        "service, nor Service RBAC Admin, which needs that or Service Root."
    },
    sys_data_admin: {
      name: "Service Data Admin",
      includes: ["sys_data_reader"],
      description: "Create, alter and drop databases, scopes, collections, views, indexes, " +
        "functions, links and catalogs, and write their data. Includes Service Data Reader."
    },
    sys_data_reader: {
      name: "Service Data Reader",
      includes: ["sys_view_reader"],
      description: "Read collections and describe links. Includes Service View Reader."
    },
    sys_view_reader: {
      name: "Service View Reader",
      description: "Read views."
    }
  };

  var SERVICE_ROLE_FOOTER = " Service roles are granted on Security > Service RBAC.";

  // Platform roles that carry cluster.analytics!manage, which the service
  // treats as a master key: ensureAuthorized returns before consulting service
  // RBAC at all, so a user holding one of these has full access no matter what
  // the metadata says. Showing them as having no service roles would be the
  // opposite of the truth.
  //
  // This is a list of role names standing in for a permission, because
  // /settings/rbac/users answers with roles and there is nothing on it that
  // resolves a permission for another user. It mirrors menelaus_roles.erl:
  // admin has {[], all}, analytics_admin has {[analytics], [manage]}, and
  // eventing_admin has {[analytics], all} - deliberately, per MB-42835. A role
  // added to that list there and not here shows the wrong thing here.
  var ANALYTICS_MANAGE_ROLES = ["admin", "analytics_admin", "eventing_admin"];

  // The platform role granting the bypass, or null. The name is wanted, not
  // just a yes/no: "all" on its own invites the question which role did that.
  function analyticsManageRole(user) {
    var held = (user.roles || []).map(function (role) { return role.role; });
    return ANALYTICS_MANAGE_ROLES.filter(function (name) {
      return held.indexOf(name) >= 0;
    })[0] || null;
  }

  var mnUserRolesService = {
    getState: getState,
    getAnalyticsGrants: getAnalyticsGrants,
    getAnalyticsPrivilegesDescription: getAnalyticsPrivilegesDescription,
    getAnalyticsUnavailableDescription: getAnalyticsUnavailableDescription,
    getAnalyticsRoleDescription: getAnalyticsRoleDescription,
    analyticsManageRole: analyticsManageRole,
    getAnalyticsManageDescription: getAnalyticsManageDescription,
    addUser: addUser,
    deleteUser: deleteUser,
    unlockUser: unlockUser,
    lockUser: lockUser,
    getRoles: getRoles,
    getUsers: getUsers,
    getUser: getUser,
    lookupLDAPUser: lookupLDAPUser,

    addGroup: addGroup,
    deleteRolesGroup: deleteRolesGroup,
    getRolesGroups: getRolesGroups,
    getRolesGroup: getRolesGroup,
    putRolesGroup: putRolesGroup,
    getRolesGroupsState: getRolesGroupsState,

    ldapConnectivityValidate: ldapConnectivityValidate,
    ldapAuthenticationValidate: ldapAuthenticationValidate,
    ldapGroupsQueryValidate: ldapGroupsQueryValidate,

    postLdapSettings: postLdapSettings,
    getLdapSettings: getLdapSettings,
    getSamlSettings: getSamlSettings,
    getRbacStatus: getRbacStatus,
    clearLdapCache: clearLdapCache,

    getUserProfile: getUserProfile,
    putUserProfile: putUserProfile,

    saveDashboard: saveDashboard,
    resetDashboard: resetDashboard,
    getSaslauthdAuth: getSaslauthdAuth,
    packRolesToSend: packRolesToSend,
    getRoleParams: getRoleParams,
    packRoleParams: packRoleParams
  };

  var clientTLSCert = "Client Cert should be supplied";
  var queryDnError = "LDAP DN should be supplied";
  var usersAttrsError = "The field can't be empty";

  return mnUserRolesService;

  function getSaslauthdAuth() {
    return $http({
      method: "GET",
      url: "/settings/saslauthdAuth"
    }).then(function (resp) {
      return resp.data;
    }, function () {
      return;
    });
  }

  function clearLdapCache() {
    return $http({
      method: "POST",
      url: "/settings/invalidateLDAPCache"
    });
  }

  function getLdapSettings() {
    return $http({
      method: "GET",
      url: "/settings/ldap"
    });
  }

  function getSamlSettings() {
    return $http({
      method: "GET",
      url: "/settings/saml"
    });
  }

  function getRbacStatus() {
    return $http({
      method: "GET",
      url: "/settings/rbac"
    });
  }

  function validateLDAPQuery(data) {
    return !!(data.userDNMapping && typeof data.userDNMapping === 'string' && data.userDNMapping.includes("query"));
  }

  function validateGroupQuery(data) {
    return !!(data.groupsQuery);
  }

  function validateGroupUserAttrs(formData) {
    return formData.queryForGroups === "users_attrs" &&
      !formData.group.groupsQuery.attributes;
  }

  function validateAuthType(errors, data, formData) {
    if ((formData.authType == "creds") && !data.bindDN) {
      errors.bindDN = queryDnError;
    }
    if ((formData.authType == "cert") && !data.clientTLSCert) {
      errors.clientTLSCert = clientTLSCert;
    }
  }

  function ldapConnectivityValidate(data, formData) {
    var errors = {};
    validateAuthType(errors, data, formData);
    if (Object.keys(errors).length) {
      return $q.reject(errors);
    } else {
      return $http.post("/settings/ldap/validate/connectivity", data);
    }
  }

  function ldapAuthenticationValidate(data, formData) {
    var errors = {};
    if (validateLDAPQuery(data)) {
      validateAuthType(errors, data, formData);
    }
    if (Object.keys(errors).length) {
      return $q.reject(errors);
    } else {
      return $http.post("/settings/ldap/validate/authentication", data);
    }
  }

  function ldapGroupsQueryValidate(data, formData) {
    var errors = {};
    if (validateGroupQuery(data)) {
      validateAuthType(errors, data, formData);
    }
    if (validateGroupUserAttrs(formData)) {
      errors.groupsQuery = usersAttrsError;
    }
    if (!data.groupsQueryUser) {
      errors.groupsQueryUser = "The field is mandatory";
    }
    if (Object.keys(errors).length) {
      return $q.reject(errors);
    } else {
      return $http.post("/settings/ldap/validate/groupsQuery", data);
    }
  }

  function getRoleParams(rolesByRole, role) {
    if (!rolesByRole || !rolesByRole[role.role]) {
      return;
    }
    return rolesByRole[role.role].params.map(param => role[param] || "*").join(":");
  }

  function packRoleParams(params) {
    let i;
    let rv = [];
    for (i = 0; i < params.length; i++) {
      let val = params[i];
      if (val == "*") {
        if (i == 0) {
          rv.push("*");
        }
        break;
      } else {
        rv.push(val);
      }
    }
    return rv.join(":");
  }

  function packRolesToSend(selectedRoles, selectedRolesConfigs) {
    return Object
      .keys(selectedRoles)
      .filter(role => selectedRoles[role])
      .concat(Object
              .keys(selectedRolesConfigs)
              .reduce((acc, role) =>
                      acc.concat((selectedRolesConfigs[role] || [])
                                 .map(config =>
                                      (role + "[" + packRoleParams(config.split(":")) + "]"))), []));
  }


  function postLdapSettings(data, formData) {
    var errors = {};
    var isGroups = data.authorizationEnabled;
    var isUser = data.authenticationEnabled;
    if ((!isUser && !isGroups) || (validateLDAPQuery(data) && isUser) ||
        (validateGroupQuery(data) && isGroups)) {
      validateAuthType(errors, data, formData);
    }
    if (isGroups && validateGroupUserAttrs(formData)) {
      errors.groupsQuery = usersAttrsError;
    }
    if (formData.connect.encryption !== "None" &&
        formData.connect.serverCertValidation == "pasteCert" &&
        !formData.connect.cacert) {
      errors.cacert = "The certificate should be provided"
    }
    if (Object.keys(errors).length) {
      return $q.reject(errors);
    } else {
      return $http({
        method: "POST",
        url: "/settings/ldap",
        data: data
      });
    }
  }

  function saveDashboard() {
    return getProfile().then(function (resp) {
      var profile = resp.data;
      profile.scenarios = mnStoreService.store("scenarios").share();
      profile.groups = mnStoreService.store("groups").share();
      profile.charts = mnStoreService.store("charts").share();
      return putUserProfile(profile);
    });
  }

  function resetDashboard() {
    return getProfile().then(function (resp) {
      var profile = resp.data;
      mnStoreService.store("charts").clear();
      mnStoreService.store("groups").clear();
      mnStoreService.store("scenarios").clear();

      mnStatisticsNewService.doAddPresetScenario();

      profile.scenarios = mnStoreService.store("scenarios").share();
      profile.groups = mnStoreService.store("groups").share();
      profile.charts = mnStoreService.store("charts").share();


      if (mnPoolDefault.export.compat.atLeast70) {
        upgradeChartsNamesTo70(profile);
      }

      return putUserProfile(profile);
    });
  }

  function putUserProfile(data) {
    return $http.put("/settings/rbac/profiles/@self", JSON.stringify(data));
  }

  function getProfile() {
    return $http.get("/settings/rbac/profiles/@self").then(null, function (resp) {
      switch (resp.status) {
      case 404:
        resp.data = {};
        return resp;
      default:
        return $q.reject();
      }
    });
  }

  function upgradeChartsNamesTo76(profile) {
    profile.charts = profile.charts.map(chart => {
      chart.stats = Object.keys(chart.stats)
          .reduce((acc, stat71) => {
            acc[mnStatsDesc.upgrade71to76(stat71)] = true;
            return acc;
          }, {});
      return chart;
    });
  }

  function upgradeChartsNamesTo71(profile) {
    profile.charts = profile.charts.map(chart => {
      chart.stats = Object.keys(chart.stats)
        .reduce((acc, stat70) => {
          acc[mnStatsDesc.upgrade70to71(stat70)] = true;
          return acc;
        }, {});
      return chart;
    });
  }

  function upgradeChartsNamesTo70(profile) {
    profile.charts = profile.charts.map(chart => {
      chart.stats = Object.keys(chart.stats)
        .reduce((acc, stat65) => {
          acc[mnStatsDesc.mapping65(stat65)] = true;
          return acc;
        }, {});
      return chart;
    });
  }

  function remove65PresetScenarios(profile) {
    profile.scenarios = profile.scenarios.filter(v => !v.preset);
    profile.groups = profile.groups.filter(v => !v.preset);
    profile.charts = profile.charts.filter(v => !v.preset);
  }

  function concatPresetAndUsersScenarios(profile) {
    profile.scenarios = profile.scenarios.concat(mnStoreService.store("scenarios").share());
    profile.groups = profile.groups.concat(mnStoreService.store("groups").share());
    profile.charts = profile.charts.concat(mnStoreService.store("charts").share());
  }

  function createPresetScenarios() {
    mnStoreService.createStore("scenarios", {keyPath: "id"});
    mnStoreService.createStore("groups", {keyPath: "id"});
    mnStoreService.createStore("charts", {keyPath: "id"});
    mnStatisticsNewService.doAddPresetScenario();
  }

  function getUserProfile() {
    return $q.all([
      getProfile(),
      mnPoolDefault.get()
    ]).then(function (resp) {
      var profile = resp[0].data;
      var poolDefault = resp[1];
      if (profile.version) {
        if (poolDefault.compat.atLeast70 && (profile.version < poolDefault.versions["70"])) {
          //remove old preset scenarios
          remove65PresetScenarios(profile);
          //generate new preset scenarios
          createPresetScenarios();
          //concat new preset scenarios and users custom scenarios
          concatPresetAndUsersScenarios(profile);
          //upgrade user/preset stat names to 70
          upgradeChartsNamesTo70(profile);
          return putUserProfile({
            version: poolDefault.versions["70"],
            scenarios: profile.scenarios,
            groups: profile.groups,
            charts: profile.charts
          }).then(getUserProfile);
        }
        if (poolDefault.compat.atLeast71 && (profile.version < poolDefault.versions["71"])) {
          upgradeChartsNamesTo71(profile);
          return putUserProfile({
            version: poolDefault.versions["71"],
            scenarios: profile.scenarios,
            groups: profile.groups,
            charts: profile.charts
          }).then(getUserProfile);
        }
        if (poolDefault.compat.atLeast76 && (profile.version < poolDefault.versions["76"])) {
          upgradeChartsNamesTo76(profile);
          return putUserProfile({
            version: poolDefault.versions["76"],
            scenarios: profile.scenarios,
            groups: profile.groups,
            charts: profile.charts
          }).then(getUserProfile);
        }
        mnStoreService.createStore("scenarios", {keyPath: "id", fill: profile.scenarios});
        mnStoreService.createStore("groups", {keyPath: "id", fill: profile.groups});
        mnStoreService.createStore("charts", {keyPath: "id", fill: profile.charts});
        return profile;
      } else {
        //inititlize user profile
        createPresetScenarios();

        return putUserProfile({
          version: poolDefault.versions["65"],
          scenarios: mnStoreService.store("scenarios").share(),
          groups: mnStoreService.store("groups").share(),
          charts: mnStoreService.store("charts").share()
        }).then(getUserProfile);
      }
    });
  }


  function getRoles() {
    return $http({
      method: "GET",
      url: "/_uiroles"
    }).then(function (resp) {
      let rv = resp.data;
      rv.rolesByRole = rv.folders.reduce((acc, group) => {
        group.roles.forEach(role => acc[role.role] = role);
        return acc;
      }, {});
      return rv;
    });
  }

  function getUser(user, params) {
    return $http({
      method: "GET",
      url: getUserUrl(user),
      params: params
    });
  }

  function lookupLDAPUser(user) {
    return $http({
      method: "GET",
      url: getLookupLDAPUserUrl(user)
    })
  }

  function getUsers(params) {
    var config = {
      method: "GET",
      url: "/settings/rbac/users"
    };

    config.params = {};
    if (params && params.permission) {
      config.params.permission = params.permission;
    }
    if (params && params.pageSize) {
      if (params.substr) {
        config.params.substr = params.substr;
      }
      config.params.pageSize = params.pageSize;
      config.params.startFromDomain = params.startFromDomain;
      config.params.startFrom = params.startFrom;
      config.params.order = params.order;
      config.params.sortBy = params.sortBy;
    }

    return $http(config);
  }

  function deleteUser(user) {
    return $http({
      method: "DELETE",
      url: getUserUrl(user)
    });
  }

  function unlockUser(user) {
    return $http({
      method: "PATCH",
      data: {
        locked: false
      },
      url: getUserUrl(user)
    });
  }

  function lockUser(user) {
    return $http({
      method: "PATCH",
      data: {
        locked: true
      },
      url: getUserUrl(user)
    });
  }

  function deleteRolesGroup(group) {
    return $http({
      method: "DELETE",
      url: "/settings/rbac/groups/" + encodeURIComponent(group.id),
    });
  }

  function getUserUrl(user) {
    var base = "/settings/rbac/users/";
    return base + encodeURIComponent(user.domain) + "/"  + encodeURIComponent(user.id);
  }

  function getLookupLDAPUserUrl(user) {
    return "/settings/rbac/lookupLDAPUser/" + encodeURIComponent(user.id);
  }

  function packData(user, roles, groups, isEditingMode, resetPassword, isEnterprise, atLeast79) {
    var data = {
      roles: roles.indexOf("admin") > -1 ? "admin" : roles.join(','),
      name: user.name
    };

    if (mnPoolDefault.export.isEnterprise) {
      data.groups = groups.join(',');
    }

    if ((!isEditingMode && user.domain == "local") || resetPassword) {
      data.password = user.password;
    }

    if (isEnterprise && atLeast79) {
      data.temporaryPassword = !!user.temporary_password;
    }

    return data;
  }

  function doAddUser(data, user) {
    return $http({
      method: "PUT",
      data: data,
      url: getUserUrl(user)
    });
  }

  function addGroup(group, roles, isEditingMode) {
    if (!group || !group.id) {
      return $q.reject({name: "name is required"});
    }
    if (isEditingMode) {
      return putRolesGroup(group, roles);
    } else {
      return getRolesGroup(group).then(function () {
        return $q.reject({name: "group already exists"});
      }, function () {
        return putRolesGroup(group, roles);
      });
    }
  }

  function getRolesGroups(params) {
    var config = {
      method: "GET",
      url: "/settings/rbac/groups",
      params: {}
    };

    if (params && params.pageSize) {
      if (params.substr) {
        config.params.substr = params.substr;
      }
      config.params.pageSize = params.pageSize;
      config.params.startFrom = params.startFrom;
      config.params.order = params.order;
      config.params.sortBy = params.sortBy;
    }

    return $http(config);
  }

  function getRolesGroup(group) {
    return $http({
      method: "GET",
      url: "/settings/rbac/groups/" + encodeURIComponent(group.id)
    });
  }

  function putRolesGroup(group, roles) {
    let data = {
      roles: roles.indexOf("admin") > -1 ? "admin" : roles.join(','),
      description: group.description
    };
    if (group.ldap_group_ref) {
      data.ldap_group_ref = group.ldap_group_ref;
    }
    var config = {
      method: "PUT",
      url: "/settings/rbac/groups/" + encodeURIComponent(group.id),
      data: data
    };

    return $http(config);
  }

  function getRolesGroupsState(params) {
    return getRolesGroups(params).then(function (resp) {
      var i;
      for (i in resp.data.links) {
        resp.data.links[i] = resp.data.links[i].split("?")[1]
          .split("&")
          .reduce(function(prev, curr) {
            var p = curr.split("=");
            prev[decodeURIComponent(p[0])] = decodeURIComponent(p[1]);
            return prev;
          }, {});
      }
      return resp.data;

    });
  }

  function addUser(user, roles, groups, isEditingMode, resetPassword, isEnterprise, atLeast79) {
    if (!user || !user.id) {
      return $q.reject({username: "username is required"});
    }
    if (isEditingMode) {
      return doAddUser(packData(user, roles, groups, isEditingMode, resetPassword, isEnterprise, atLeast79), user);
    } else {
      return getUser(user).then(function () {
        return $q.reject({username: "username already exists"});
      }, function () {
        return doAddUser(packData(user, roles, groups, isEditingMode, false, isEnterprise, atLeast79), user);
      });
    }
  }

  // A user's service roles and the count of privileges granted straight to
  // them, both keyed by domain and name - which together are what identifies an
  // account, the same name in the other domain being someone else. The grant's
  // own account id rides along so getState can tell a live grant from one left
  // by a deleted user of that name.
  //
  // Answers empty rather than failing: this decorates the users table and must
  // never be the reason it does not load, whether analytics is unreachable or
  // the viewer simply may not read its metadata.
  function getAnalyticsGrants() {
    return $http({
      method: "POST",
      url: "/_p/cbas/api/v1/request",
      headers: {
        "Content-Type": "application/json",
        "ignore-401": "true",
        "Analytics-Priority": "-1"
      },
      data: {statement: ANALYTICS_GRANTS_QUERY, source: "ui_users"},
      mnHttp: {isNotForm: true, group: "global"}
    }).then(function (resp) {
      var grants = {roles: {}, privileges: {}, ids: {}, available: true};
      if (resp.data && resp.data.errors) {
        grants.available = false;
        return grants;
      }
      ((resp.data && resp.data.results) || []).forEach(function (row) {
        var key = (row.Domain || "local") + ":" + row.Grantee;
        if (row.Id) {
          grants.ids[key] = row.Id;
        }
        if (row.RoleName) {
          grants.roles[key] = (grants.roles[key] || []).concat(row.RoleName);
        } else {
          grants.privileges[key] = (grants.privileges[key] || 0) + 1;
        }
      });
      return grants;
    }, function () {
      // Unreachable, or refused. Either way the columns cannot be filled, and
      // saying so is the whole point of the flag: an empty answer and an answer
      // of "none" look identical in the table, and the second is a claim.
      return {roles: {}, privileges: {}, ids: {}, available: false};
    });
  }

  // The tooltip behind the "all" label: which platform role is responsible, and
  // that it outranks anything on the Service RBAC tab.
  //
  // Named by its display name, taken from the roles the server describes -
  // "analytics_admin" is an internal id, and the display name follows a product
  // rename where the id does not. Falls back to the id when the role list has
  // not arrived, which is better than saying nothing.
  function getAnalyticsManageDescription(roleId, rolesByRole) {
    var described = rolesByRole && rolesByRole[roleId];
    var name = (described && described.name) || roleId;
    return "Can manage this service through the " + name +
      " platform role, which bypasses service roles entirely." + SERVICE_ROLE_FOOTER;
  }

  // The tooltip behind a dash that means "not read". Without it the column is
  // indistinguishable from a user who holds nothing, which is a claim this page
  // is in no position to make when the service did not answer.
  function getAnalyticsUnavailableDescription() {
    return "Could not be read: the analytics service did not answer. This is not " +
      "a claim that the user holds nothing." + SERVICE_ROLE_FOOTER;
  }

  // The tooltip behind the direct-privilege count. Says what makes a privilege
  // direct, because the number is otherwise indistinguishable from whatever the
  // user's roles happen to carry - which is the larger number, and not this one.
  function getAnalyticsPrivilegesDescription(count) {
    return count + " privilege(s) granted straight to this user, not through any " +
      "service role. Privileges their roles carry are not counted here." + SERVICE_ROLE_FOOTER;
  }

  // The tooltip behind a role name. Always says where these are administered,
  // because this page shows them and cannot change them.
  function getAnalyticsRoleDescription(roleName) {
    var known = BUILT_IN_ROLES[roleName];
    return (known ? known.description
             : "A custom service role. Its privileges are listed on the Service RBAC tab.") +
      SERVICE_ROLE_FOOTER;
  }

  function getState(params, withAnalyticsRoles) {
    if (withAnalyticsRoles) {
      return $q.all([getStateWithoutAnalyticsRoles(params), getAnalyticsGrants()])
        .then(function (results) {
          var state = results[0];
          var grants = results[1];
          state.analyticsUnavailable = !grants.available;
          (state.users || []).forEach(function (user) {
            var key = (user.domain || "local") + ":" + user.id;
            var stale = isStaleGrant(user, grants.ids[key]);
            user.analyticsRoles = stale ? [] : (grants.roles[key] || []);
            user.analyticsPrivileges = stale ? 0 : (grants.privileges[key] || 0);
            user.analyticsManageRole = analyticsManageRole(user);
          });
          return state;
        });
    }
    return getStateWithoutAnalyticsRoles(params);
  }

  // Whether what the metadata records under this name was granted to somebody
  // else: an account of that name that has since been deleted. The engine
  // compares the same two ids and refuses such a grant, so crediting the live
  // user with it would show roles and privileges they do not have.
  //
  // Both ids must be present before this says yes. ns_server issues none for an
  // external user, and the engine mints its own and stores it nowhere else, so
  // there is nothing to compare and the name is the identity there - which is
  // how the engine treats an external user too. The Service RBAC tab separates
  // the two accounts into their own rows; here there is only one row per user,
  // so the stale grants are simply not shown against it.
  function isStaleGrant(user, grantedToId) {
    return !!(user.uuid && grantedToId && user.uuid !== grantedToId);
  }

  function getStateWithoutAnalyticsRoles(params) {
    return getUsers(params).then(function (resp) {
      var i;
      for (let key in resp.data.users) {
        if (resp.data.users[key].password_change_date) {
          resp.data.users[key].password_change_date_subject = new BehaviorSubject(resp.data.users[key].password_change_date);
        }
      }

      for (i in resp.data.links) {
        resp.data.links[i] = resp.data.links[i].split("?")[1]
          .split("&")
          .reduce(function(prev, curr) {
            var p = curr.split("=");
            prev[decodeURIComponent(p[0])] = decodeURIComponent(p[1]);
            return prev;
          }, {});
      }
      if (!resp.data.users) {//in oreder to support compatibility mode
        return {
          users: resp.data
        };
      } else {
        return resp.data;
      }
    });
  }
}
