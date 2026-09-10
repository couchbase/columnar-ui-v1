/*
Copyright 2026-Present Couchbase, Inc.

Use of this software is governed by the Business Source License included in
the file licenses/BSL-Couchbase.txt.  As of the Change Date specified in that
file, in accordance with the Business Source License, use of this software will
be governed by the Apache License, Version 2.0, included in the file
licenses/APL2.txt.
*/

// The service-roles column on Users & Groups.
//
// It is read-only, so there is no statement to judge it by - the decisions
// are what the query asks for, how the answer is keyed onto users, and what
// happens when it fails. All three are silent when wrong: the column simply
// shows the wrong roles, or none.

import {makeUsersEnv, ANALYTICS_QUERY_URL} from "./users_env.js";
import {BUILT_IN_ROLES} from "/_p/ui/cbas/cw_rbac_service.js";
import {ok, equal, contains} from "./assert.js";

// Answers the analytics query with `rows`, and every other call with an empty
// users page.
function withRows(env, rows) {
  env.onHttp(function (config) {
    if (config.url === ANALYTICS_QUERY_URL) {
      return env.$q.resolve({data: {results: rows}});
    }
    return env.$q.resolve({data: {users: [{id: "jo", domain: "local"},
                                          {id: "jo", domain: "external"}]}});
  });
}

export default [

  ['the grants read asks only for user grantees, and skips ownership', function () {
    // A grant to another role is not something to show against a user, and
    // rolling it in would credit people with roles they do not hold. Ownership
    // is recorded per object created, so counting it would report thousands of
    // direct privileges against whoever built the databases.
    const env = makeUsersEnv();
    withRows(env, []);
    env.settle(env.service.getAnalyticsGrants());

    const query = env.requests.filter(r => r.url === ANALYTICS_QUERY_URL)[0];
    ok(query, 'the service must ask the analytics service');
    contains(query.data.statement, "Metadata.`AssignedRole`");
    contains(query.data.statement, "Metadata.`Privilege`");
    contains(query.data.statement, "GranteeType = 'USER'");
    contains(query.data.statement, "OWNERSHIP");
    equal(env.requests.filter(r => r.url === ANALYTICS_QUERY_URL).length, 1,
          'one read, because this rides the users poller');
  }],

  ['roles are keyed by domain as well as name', function () {
    // The same name in the other domain is a different account. Keying on the
    // name alone shows one user's roles against the other's row.
    const env = makeUsersEnv();
    withRows(env, [
      {Grantee: "jo", Domain: "local", RoleName: "analyst"},
      {Grantee: "jo", Domain: "external", RoleName: "auditor"}
    ]);
    const grants = env.settle(env.service.getAnalyticsGrants()).value;

    equal(grants.roles["local:jo"].length, 1);
    equal(grants.roles["local:jo"][0], "analyst");
    equal(grants.roles["external:jo"][0], "auditor", 'the other domain is another account');
  }],

  ['both halves of the read answer under the same field names', function () {
    // SQL++ does not rename a UNION ALL branch positionally: each branch keeps
    // the names it selects. Without an alias on every column the privilege half
    // comes back as GranteeDomain and GranteeUuid, and is then keyed as though
    // every grantee were local - so an external user's privileges are counted
    // against the local user of that name. Seeded rows cannot catch this,
    // because a test writes them in whatever shape it likes; only the statement
    // can be asserted on.
    const env = makeUsersEnv();
    withRows(env, []);
    env.settle(env.service.getAnalyticsGrants());

    const statement = env.requests.filter(r => r.url === ANALYTICS_QUERY_URL)[0].data.statement;
    contains(statement, "p.GranteeDomain AS Domain");
    contains(statement, "p.GranteeUuid AS Id");
    contains(statement, "p.Grantee AS Grantee");
  }],

  ['a row with no role name is a privilege, and is counted', function () {
    // One statement answers both halves, so the two are told apart by shape:
    // an assignment names a role, a privilege does not.
    const env = makeUsersEnv();
    withRows(env, [
      {Grantee: "jo", Domain: "local", RoleName: "analyst"},
      {Grantee: "jo", Domain: "local", RoleName: null},
      {Grantee: "jo", Domain: "local", RoleName: null},
      {Grantee: "sam", Domain: "local", RoleName: null}
    ]);
    const grants = env.settle(env.service.getAnalyticsGrants()).value;

    equal(grants.roles["local:jo"].join(","), "analyst", 'the role, and only the role');
    equal(grants.privileges["local:jo"], 2);
    equal(grants.privileges["local:sam"], 1);
    equal(grants.privileges["local:nobody"], undefined, 'absent, so the column shows a dash');
  }],

  ['a user with several roles keeps all of them', function () {
    const env = makeUsersEnv();
    withRows(env, [
      {Grantee: "jo", Domain: "local", RoleName: "analyst"},
      {Grantee: "jo", Domain: "local", RoleName: "auditor"}
    ]);
    const grants = env.settle(env.service.getAnalyticsGrants()).value;
    equal(grants.roles["local:jo"].join(","), "analyst,auditor");
  }],

  ['each role explains itself, and says where it can be changed', function () {
    // The column is read-only, so the tooltip is the only place that can point
    // at the tab which does grant and revoke.
    const env = makeUsersEnv();
    const builtIn = env.service.getAnalyticsRoleDescription("sys_data_reader");
    contains(builtIn, "Read collections", 'what the role actually allows');
    contains(builtIn, "Service RBAC", 'and where it is administered');

    // A role the engine did not create has no canned description, but still
    // needs to say where to look.
    const custom = env.service.getAnalyticsRoleDescription("analyst");
    contains(custom, "custom service role");
    contains(custom, "Service RBAC");
  }],

  ['a platform role that outranks service RBAC is not shown as no access', function () {
    // ensureAuthorized returns before consulting service RBAC for anyone
    // holding cluster.analytics!manage, so an em-dash against such a user
    // would say the opposite of the truth: they can do everything.
    const env = makeUsersEnv();
    env.onHttp(function (config) {
      if (config.url === ANALYTICS_QUERY_URL) {
        return env.$q.resolve({data: {results: []}});
      }
      return env.$q.resolve({data: {users: [
        {id: "boss", domain: "local", roles: [{role: "analytics_admin"}]},
        {id: "root", domain: "local", roles: [{role: "admin"}]},
        {id: "jo", domain: "local", roles: [{role: "analytics_reader"}]}
      ]}});
    });
    const state = env.settle(env.service.getState({}, true)).value;
    const by = {};
    state.users.forEach(u => { by[u.id] = u; });

    equal(by.boss.analyticsManageRole, "analytics_admin");
    equal(by.root.analyticsManageRole, "admin", 'full admin carries it too');
    // Reaching the service is not the same as being exempt from its rules.
    equal(by.jo.analyticsManageRole, null, 'analytics_reader is a door, not a key');
  }],

  ['the bypass is explained, and names the role as the server displays it', function () {
    // "analytics_admin" is an internal id. The display name is what the server
    // describes the role as, and the only one of the two that follows a
    // product rename.
    const env = makeUsersEnv();
    const described = env.service.getAnalyticsManageDescription(
      "analytics_admin", {analytics_admin: {name: "Analytics Admin"}});
    contains(described, "Analytics Admin", 'the display name, not the id');
    contains(described, "bypasses service roles");

    // The roles are fetched separately from the users, so the tooltip has to
    // read sensibly before that answer lands.
    const bare = env.service.getAnalyticsManageDescription("analytics_admin", null);
    contains(bare, "analytics_admin", 'falls back to the id rather than saying nothing');
  }],

  ['the built-in role descriptions match the ones on the Service RBAC tab', function () {
    // The same five roles are described on two pages in two repos. cbas-ui is
    // a pluggable UI, so this repo cannot import from it and the map is
    // duplicated by force; nothing but this comparison stops the two drifting
    // into saying different things about the same role.
    const env = makeUsersEnv();
    Object.keys(BUILT_IN_ROLES).forEach(function (role) {
      const here = env.service.getAnalyticsRoleDescription(role);
      contains(here, BUILT_IN_ROLES[role].description,
               role + ' is described differently on the two pages');
    });

    // And neither copy may quietly lose a role the other still has.
    const missing = Object.keys(BUILT_IN_ROLES).filter(function (role) {
      return env.service.getAnalyticsRoleDescription(role).indexOf("custom service role") >= 0;
    });
    equal(missing.length, 0, 'not described on Users & Groups: ' + missing.join(', '));
  }],

  ['the column decorates the page and must never break it', function () {
    // Analytics being unreachable, or the viewer not being allowed to read its
    // metadata, costs the column - not the list of users.
    const env = makeUsersEnv();
    env.onHttp(function (config) {
      if (config.url === ANALYTICS_QUERY_URL) {
        return env.$q.reject({status: 403});
      }
      return env.$q.resolve({data: {users: []}});
    });
    const settled = env.settle(env.service.getAnalyticsGrants());
    equal(settled.error, undefined, 'a failed read must not reject');
    equal(Object.keys(settled.value.roles).length, 0);
    equal(Object.keys(settled.value.privileges).length, 0);
  }],

  ['an errors body is a failure too, not a set of roles', function () {
    // The query endpoint answers a rejected statement with 200 and an errors
    // array, so status alone does not say whether this worked.
    const env = makeUsersEnv();
    env.onHttp(function (config) {
      if (config.url === ANALYTICS_QUERY_URL) {
        return env.$q.resolve({data: {errors: [{code: 20001, msg: "Insufficient permissions"}]}});
      }
      return env.$q.resolve({data: {users: []}});
    });
    const grants = env.settle(env.service.getAnalyticsGrants()).value;
    equal(Object.keys(grants.roles).length, 0, 'an errors body must not read as roles');
    equal(Object.keys(grants.privileges).length, 0);
  }],

  ['users are decorated with their grants, and everyone else with none', function () {
    const env = makeUsersEnv();
    withRows(env, [{Grantee: "jo", Domain: "local", RoleName: "analyst"},
                   {Grantee: "jo", Domain: "local", RoleName: null}]);
    const state = env.settle(env.service.getState({}, true)).value;

    const local = state.users.filter(u => u.domain === "local")[0];
    const external = state.users.filter(u => u.domain === "external")[0];
    equal(local.analyticsRoles[0], "analyst");
    equal(local.analyticsPrivileges, 1);
    equal(external.analyticsRoles.length, 0, 'an empty list, not undefined');
    equal(external.analyticsPrivileges, 0, 'a zero, not undefined - the column shows a dash');
  }],

  ['grants left by a deleted account are not credited to the live user', function () {
    // Delete a user and create another of that name and the directory issues a
    // new id, so the rows left behind grant nothing. This page has one row per
    // user, so they are simply not shown against it - the Service RBAC tab is
    // where the deleted account gets a row of its own.
    const env = makeUsersEnv();
    env.onHttp(function (config) {
      if (config.url === ANALYTICS_QUERY_URL) {
        return env.$q.resolve({data: {results: [
          {Grantee: "jo", Domain: "local", Id: "old-uuid", RoleName: "analyst"},
          {Grantee: "jo", Domain: "local", Id: "old-uuid", RoleName: null}
        ]}});
      }
      return env.$q.resolve({data: {users: [{id: "jo", domain: "local", uuid: "new-uuid"}]}});
    });
    const state = env.settle(env.service.getState({}, true)).value;

    equal(state.users[0].analyticsRoles.length, 0, 'not the live account\'s role');
    equal(state.users[0].analyticsPrivileges, 0);
  }],

  ['an external grantee keeps its grants, having no directory id to match', function () {
    // ns_server issues no uuid for an external user; the engine mints one and
    // stores it only in its own metadata. Treating that as a mismatch would
    // strip every external user on the cluster of everything they hold.
    const env = makeUsersEnv();
    env.onHttp(function (config) {
      if (config.url === ANALYTICS_QUERY_URL) {
        return env.$q.resolve({data: {results: [
          {Grantee: "sam", Domain: "external", Id: "engine-minted", RoleName: "analyst"}
        ]}});
      }
      return env.$q.resolve({data: {users: [{id: "sam", domain: "external"}]}});
    });
    const state = env.settle(env.service.getState({}, true)).value;
    equal(state.users[0].analyticsRoles[0], "analyst");
  }],

  ['an unanswered read is flagged, not reported as holding nothing', function () {
    // The two columns are the whole of what the service contributes here. An
    // empty answer and an answer of "none" fill them identically, and the
    // second is a claim this page is in no position to make.
    const env = makeUsersEnv();
    env.onHttp(function (config) {
      if (config.url === ANALYTICS_QUERY_URL) {
        return env.$q.reject({status: 404, data: "Service cbas not running on this node"});
      }
      return env.$q.resolve({data: {users: [{id: "jo", domain: "local"}]}});
    });
    const state = env.settle(env.service.getState({}, true)).value;

    equal(state.analyticsUnavailable, true);
    equal(state.users[0].analyticsRoles.length, 0, 'still an empty list, not undefined');
    equal(state.users[0].analyticsPrivileges, 0);
  }],

  ['a refused read is flagged the same way', function () {
    const env = makeUsersEnv();
    env.onHttp(function (config) {
      if (config.url === ANALYTICS_QUERY_URL) {
        return env.$q.resolve({data: {errors: [{code: 20001, msg: "Insufficient permissions"}]}});
      }
      return env.$q.resolve({data: {users: [{id: "jo", domain: "local"}]}});
    });
    equal(env.settle(env.service.getState({}, true)).value.analyticsUnavailable, true);
  }],

  ['an answered read is not flagged', function () {
    const env = makeUsersEnv();
    withRows(env, [{Grantee: "jo", Domain: "local", RoleName: "analyst"}]);
    const state = env.settle(env.service.getState({}, true)).value;
    equal(state.analyticsUnavailable, false, 'a real answer of "none" is still an answer');
  }],

  ['the unavailable tooltip does not claim the user holds nothing', function () {
    const text = makeUsersEnv().service.getAnalyticsUnavailableDescription();
    contains(text, "Could not be read");
    contains(text, "not a claim");
  }],

  ['the query is not issued when the column is not shown', function () {
    // It is only asked for by someone who may administer analytics RBAC, so a
    // viewer without that permission must not be polling the endpoint every
    // ten seconds to be told no.
    const env = makeUsersEnv();
    withRows(env, []);
    env.settle(env.service.getState({}, false));
    equal(env.requests.filter(r => r.url === ANALYTICS_QUERY_URL).length, 0);
  }],

];
