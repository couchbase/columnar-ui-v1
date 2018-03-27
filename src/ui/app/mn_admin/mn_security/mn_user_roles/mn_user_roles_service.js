(function () {
  "use strict";

  angular
    .module("mnUserRolesService", ['mnHelper'])
    .factory("mnUserRolesService", mnUserRolesFactory);

  function mnUserRolesFactory($q, $http, mnHelper, mnPoolDefault) {
    var mnUserRolesService = {
      getState: getState,
      addUser: addUser,
      getRoles: getRoles,
      deleteUser: deleteUser,
      getRolesByRole: getRolesByRole,
      getRolesTree: getRolesTree,
      getUsers: getUsers,
      getRoleUIID: getRoleUIID
    };

    return mnUserRolesService;

    function getRoles() {
      return $http({
        method: "GET",
        url: "/settings/rbac/roles"
      }).then(function (resp) {
        return resp.data;
      });
    }

    function getWrapperName(name) {
      switch (name) {
      case "data": return "Data Service";
      case "views": return "Views";
      case "query": return "Query and Index Services";
      case "fts": return "Search Service";
      case "analytics": return "Analytics Service";
      case "undefined": return "Administration & Global Roles";
      case "*": return "All Buckets (*)";
      case "replication":
      case "bucket": return undefined;
      default: return name;
      }
    }

    function sortAdminAndGlobalRoles(roles) {
      var rv = new Array(8);

      roles.forEach(function (role) {
        switch (role.role) {
        case "admin": rv[0] = role; break;
        case "cluster_admin": rv[1] = role; break;
        case "security_admin": rv[2] = role; break;
        case "ro_admin": rv[3] = role; break;
        case "replication_admin": rv[4] = role; break;
        case "query_external_access": rv[5] = role; break;
        case "query_system_catalog": rv[6] = role; break;
        case "analytics_reader": rv[7] = role; break;
        default: rv.push(role); break;
        }
      });

      return rv;
    }

    function sortBucketRoles(roles) {
      var rv = [];
      var restRoles = new Array(5);

      _.forEach(_.groupBy(roles, function (role) {
        return role.role.split("_")[0];
      }), function (value, key) {
        switch(key) {
        case "data": restRoles[0] = [getWrapperName(key), value]; break;
        case "views": restRoles[1] = [getWrapperName(key), value]; break;
        case "query": restRoles[2] = [getWrapperName(key), value]; break;
        case "fts": restRoles[3] = [getWrapperName(key), value]; break;
        case "analytics": restRoles[4] = [getWrapperName(key), value]; break;
        case "bucket":
        case "replication": rv = rv.concat(value); break;
        default: restRoles[5].push([getWrapperName(key), value]); break;
        }
      });

      return rv.concat(restRoles);
    }

    function prepareRootRoles(roles) {
      var rv = new Array(2);

      _.forEach(_.groupBy(roles, 'bucket_name'), function (value, key) {
        switch (key) {
        case "undefined": rv[0] = [getWrapperName(key), sortAdminAndGlobalRoles(value)]; break;
        case "*": rv[1] = [getWrapperName(key), sortBucketRoles(value)]; break;
        default: rv.push([getWrapperName(key), sortBucketRoles(value)]); break;
        }
      });

      return rv;
    }

    function getRolesTree(roles) {
      return prepareRootRoles(roles);
    }

    function getRoleUIID(role, isWrapper) {
      var rv = "";
      var bucketWrapperName = getWrapperName(role.bucket_name || "undefined");
      var serviceWrapperName;
      if (role.bucket_name) {
        serviceWrapperName = getWrapperName(role.role.split("_")[0]);
      }
      rv += bucketWrapperName;
      if (serviceWrapperName) {
        rv += ("|" + serviceWrapperName);
      }
      if (!isWrapper) {
        rv += ("|" + (role.bucket_name ? (role.role + '[' + role.bucket_name + ']') : role.role));
      }
      return rv;
    }

    function getUser(user) {
      return $http({
        method: "GET",
        url: getUserUrl(user)
      });
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
        config.params.pageSize = params.pageSize;
        config.params.startFromDomain = params.startFromDomain;
        config.params.startFrom = params.startFrom;
      }

      return $http(config);
    }

    function deleteUser(user) {
      return $http({
        method: "DELETE",
        url: getUserUrl(user)
      });
    }

    function getUserUrl(user) {
      var base = "/settings/rbac/users/";
      if (mnPoolDefault.export.compat.atLeast50) {
        return base + encodeURIComponent(user.domain) + "/"  + encodeURIComponent(user.id);
      } else {
        return base + encodeURIComponent(user.id);
      }
    }

    function getRolesByRole(userRoles) {
      return (userRoles ? $q.when(userRoles) : getRoles()).then(function (roles) {
        var rolesByRole = {};
        angular.forEach(roles, function (role) {
          rolesByRole[role.role + (role.bucket_name ? '[' + role.bucket_name + ']' : '')] = role;
        });
        return rolesByRole;
      });
    }

    function packData(user, roles, isEditingMode, resetPassword) {
      var data = {
        roles: roles.indexOf("admin") > -1 ? "admin" : roles.join(','),
        name: user.name
      };

      if ((!isEditingMode && user.domain == "local") || resetPassword) {
        data.password = user.password;
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

    function addUser(user, roles, isEditingMode, resetPassword) {
      if (!user || !user.id) {
        return $q.reject({username: "username is required"});
      }
      if (!resetPassword && (!roles || !roles.length)) {
        return $q.reject({roles: "at least one role should be added"});
      }
      if (isEditingMode) {
        return doAddUser(packData(user, roles, isEditingMode, resetPassword), user);
      } else {
        return getUser(user).then(function (users) {
          return $q.reject({username: "username already exists"});
        }, function () {
          return doAddUser(packData(user, roles, isEditingMode), user);
        });
      }

    }

    function getState(params) {
      return getUsers(params).then(function (resp) {
        var i;
        for (i in resp.data.links) {
          resp.data.links[i] = resp.data.links[i].split("?")[1]
            .split("&")
            .reduce(function(prev, curr, i, arr) {
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
})();
