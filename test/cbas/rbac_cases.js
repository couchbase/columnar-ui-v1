/*
Copyright 2026-Present Couchbase, Inc.

Use of this software is governed by the Business Source License included in
the file licenses/BSL-Couchbase.txt.  As of the Change Date specified in that
file, in accordance with the Business Source License, use of this software will
be governed by the Apache License, Version 2.0, included in the file
licenses/APL2.txt.
*/

// What the Service RBAC page does, judged by the DDL it would have sent.
//
// This page has no REST API behind it: a grant is a statement, and a statement
// the parser reads differently from what the form said is a grant nobody asked
// for. So the statement is the assertion, here as in cases.js.
//
// The forms asserted below are the ones the engine's grammar accepts - each has
// a counterpart in the analytics project's own rbac test suite - and the cases
// that matter most are the ones where two readings of the same words differ:
// CREATE COLLECTION as a privilege versus CREATE on collections, and a bare
// grantee name meaning a role rather than a user.

import {makeRbacEnv} from "./rbac_env.js";
import {
  rolesIncludedBy,
  buildCreateRole,
  buildDropRole,
  buildGrant,
  buildRevoke,
  buildGrantRoles,
  buildRevokeRoles,
  revokeForGrant,
  describeTarget,
  quoteId
} from "/_p/ui/cbas/cw_rbac_service.js";

import {ok, equal, contains, omits} from "./assert.js";

const ROLE = name => ({name: name, type: "ROLE"});
const USER = (name, domain) => ({name: name, type: "USER", domain: domain});

// A page with one custom role, one built-in, and a user holding the custom one.
function page(extra) {
  return makeRbacEnv(Object.assign({
    roles: [{RoleName: "analyst", Creator: "admin"},
            {RoleName: "sys_data_reader", Creator: "@sys"}],
    privileges: [{
      Grantee: "analyst", GranteeType: "ROLE", Privilege: "SELECT",
      Object: {ObjectType: "COLLECTION", DatabaseName: "db", ScopeName: "sales", ObjectName: "orders"}
    }],
    assignments: [{
      Assignee: "jo", AssigneeDomain: "local", GranteeType: "USER", AssignedRoleName: "analyst"
    }],
    users: [{id: "jo", domain: "local", name: "Jo"},
            {id: "sam", domain: "external", name: "Sam"}],
    databases: ["db"],
    scopes: [{database: "db", scope: "sales"}]
  }, extra || {}));
}

// Opens the grant dialog on `analyst`, chooses an object type and then fills
// the rest in. The two steps are separate because that is the order a user
// works in, and because choosing a type clears what was ticked before it.
function grantDialog(env, objectType, fill) {
  const role = env.controller.roles.filter(r => r.name === "analyst")[0];
  env.controller.grantToRole(role);
  return fillGrantDialog(env, objectType, fill);
}

// The same dialog, opened on a user instead.
function grantDialogForUser(env, id, objectType, fill) {
  const user = env.controller.users.filter(u => u.id === id)[0];
  ok(user, 'no such user: ' + id);
  env.controller.grantToUser(user);
  return fillGrantDialog(env, objectType, fill);
}

function fillGrantDialog(env, objectType, fill) {
  const scope = env.modal.scope();
  env.digest();
  scope.options.objectType = objectType;
  env.digest();
  if (fill) {
    fill(scope);
    env.digest();
  }
  return scope;
}

export default [

  // ------------------------------------------------------ statement building

  ['a role name is quoted, so a role called `select` is still a role name', function () {
    equal(buildCreateRole("select"), "CREATE ROLE `select`");
    equal(buildDropRole("my role"), "DROP ROLE `my role`");
    // A backtick in a name closes the quoting unless it is doubled, which is
    // the difference between a bad name and an injected statement.
    equal(quoteId("a`b"), "`a``b`");
  }],

  ['a grant to a role says ROLE, because a bare name is not a user', function () {
    equal(buildGrant({
      privileges: ["SELECT"], objectType: "COLLECTION", ddl: false,
      targetKind: "OBJECT", target: {database: "db", scope: "sales", name: "orders"},
      grantees: [ROLE("analyst")]
    }), "GRANT SELECT ON COLLECTION `db`.`sales`.`orders` TO ROLE `analyst`");
  }],

  ['an external user is granted as an external user', function () {
    // Domain is part of the grantee's identity: the same name in the other
    // domain is a different account, and a grant that omits EXTERNAL lands on
    // the local one.
    equal(buildGrant({
      privileges: ["SELECT"], objectType: "COLLECTION", ddl: false,
      targetKind: "ANY", target: {}, grantees: [USER("sam", "external")]
    }), "GRANT SELECT ON ANY COLLECTION TO EXTERNAL USER `sam`");

    equal(buildGrant({
      privileges: ["SELECT"], objectType: "COLLECTION", ddl: false,
      targetKind: "ANY", target: {}, grantees: [USER("jo", "local")]
    }), "GRANT SELECT ON ANY COLLECTION TO USER `jo`");
  }],

  ['a privilege over objects that do not exist yet is written without ON', function () {
    // GRANT CREATE COLLECTION IN SCOPE ... - no ON, because there is no
    // collection to name. With an ON the parser reads a different privilege.
    equal(buildGrant({
      privileges: ["CREATE", "DROP"], objectType: "COLLECTION", ddl: true,
      targetKind: "SCOPE", target: {database: "db", scope: "sales"},
      grantees: [ROLE("analyst")]
    }), "GRANT CREATE, DROP COLLECTION IN SCOPE `db`.`sales` TO ROLE `analyst`");

    equal(buildGrant({
      privileges: ["CREATE"], objectType: "DATABASE", ddl: true,
      targetKind: "ANY", target: {}, grantees: [ROLE("analyst")]
    }), "GRANT CREATE DATABASE TO ROLE `analyst`");
  }],

  ['CREATE COLLECTION on a link is the link privilege, not CREATE on collections', function () {
    // The grammar tells the two apart by what follows: CREATE COLLECTION is one
    // privilege only when a comma or an ON comes next. Both statements below
    // are legal and mean different things, so the ON is not decoration.
    const statement = buildGrant({
      privileges: ["CREATE COLLECTION"], objectType: "LINK", ddl: false,
      targetKind: "NAME", target: {name: "s3link"}, grantees: [ROLE("analyst")]
    });
    equal(statement, "GRANT CREATE COLLECTION ON LINK `s3link` TO ROLE `analyst`");
    contains(statement, "ON LINK", 'without the ON this grants CREATE over collections');
  }],

  ['a two-word privilege cannot be built into a statement with no object', function () {
    let failed = false;
    try {
      buildGrant({
        privileges: ["CREATE COLLECTION"], objectType: "LINK", ddl: true,
        targetKind: "ANY", target: {}, grantees: [ROLE("analyst")]
      });
    } catch (error) {
      failed = true;
    }
    ok(failed, 'CREATE COLLECTION with no ON silently means CREATE on collections');
  }],

  ['an index privilege names the collections it covers', function () {
    // INDEX is the one type whose DDL form still carries an ON, so a statement
    // built like the other DDL types would not parse.
    equal(buildGrant({
      privileges: ["CREATE"], objectType: "INDEX", ddl: true,
      targetKind: "SCOPE", target: {database: "db", scope: "sales"},
      grantees: [ROLE("analyst")]
    }), "GRANT CREATE INDEX ON ANY COLLECTION IN SCOPE `db`.`sales` TO ROLE `analyst`");

    equal(buildGrant({
      privileges: ["DROP"], objectType: "INDEX", ddl: true,
      targetKind: "OBJECT", target: {database: "db", scope: "sales", name: "orders"},
      grantees: [ROLE("analyst")]
    }), "GRANT DROP INDEX ON COLLECTION `db`.`sales`.`orders` TO ROLE `analyst`");
  }],

  ['a function grant carries the arity, which is part of its name', function () {
    equal(buildGrant({
      privileges: ["EXECUTE"], objectType: "FUNCTION", ddl: false,
      targetKind: "OBJECT", target: {database: "db", scope: "sales", name: "rstr", arity: 2},
      grantees: [ROLE("analyst")]
    }), "GRANT EXECUTE ON FUNCTION `db`.`sales`.`rstr`(2) TO ROLE `analyst`");

    // No arity given means every overload, which is a different grant and must
    // not be written as (undefined).
    omits(buildGrant({
      privileges: ["EXECUTE"], objectType: "FUNCTION", ddl: false,
      targetKind: "OBJECT", target: {database: "db", scope: "sales", name: "rstr"},
      grantees: [ROLE("analyst")]
    }), "(");
  }],

  ['a target form the grammar does not accept is refused, not written', function () {
    let failed = false;
    try {
      // There is no "every link in a database": links are not scoped, and the
      // parser has no production for it.
      buildGrant({
        privileges: ["CONNECT"], objectType: "LINK", ddl: false,
        targetKind: "DATABASE", target: {database: "db"}, grantees: [ROLE("analyst")]
      });
    } catch (error) {
      failed = true;
    }
    ok(failed, 'a link grant scoped to a database would fail at the server');
  }],

  ['revoke mirrors the grant it undoes', function () {
    const spec = {
      privileges: ["SELECT", "INSERT"], objectType: "COLLECTION", ddl: false,
      targetKind: "SCOPE", target: {database: "db", scope: "sales"}, grantees: [ROLE("analyst")]
    };
    equal(buildGrant(spec).replace(/^GRANT /, "").replace(/ TO /, " FROM "),
          buildRevoke(spec).replace(/^REVOKE /, ""),
          'a revoke that does not mirror its grant leaves the privilege behind');
  }],

  ['a stored grant can be revoked exactly as it was granted', function () {
    // The metadata records the target as the parser resolved it, so the form is
    // read back off the record: three names is one object, a database alone is
    // every collection in it.
    equal(revokeForGrant({
      Grantee: "analyst", GranteeType: "ROLE", Privilege: "SELECT",
      Object: {ObjectType: "COLLECTION", DatabaseName: "db", ScopeName: "sales", ObjectName: "orders"}
    }), "REVOKE SELECT ON COLLECTION `db`.`sales`.`orders` FROM ROLE `analyst`");

    equal(revokeForGrant({
      Grantee: "analyst", GranteeType: "ROLE", Privilege: "SELECT",
      Object: {ObjectType: "COLLECTION", DatabaseName: "db"}
    }), "REVOKE SELECT ON ANY COLLECTION IN DATABASE `db` FROM ROLE `analyst`");

    // A scope-wide grant read back as a database-wide one would revoke more
    // than was granted, and quietly succeed doing it.
    equal(revokeForGrant({
      Grantee: "analyst", GranteeType: "ROLE", Privilege: "SELECT",
      Object: {ObjectType: "COLLECTION", DatabaseName: "db", ScopeName: "sales"}
    }), "REVOKE SELECT ON ANY COLLECTION IN SCOPE `db`.`sales` FROM ROLE `analyst`");

    equal(revokeForGrant({
      Grantee: "jo", GranteeType: "USER", GranteeDomain: "external", Privilege: "CONNECT",
      Object: {ObjectType: "LINK", ObjectName: "s3link"}
    }), "REVOKE CONNECT ON LINK `s3link` FROM EXTERNAL USER `jo`");

    // A DDL grant read back must not grow an ON.
    equal(revokeForGrant({
      Grantee: "analyst", GranteeType: "ROLE", Privilege: "CREATE",
      Object: {ObjectType: "DATABASE"}
    }), "REVOKE CREATE DATABASE FROM ROLE `analyst`");
  }],

  ['role assignment names the role and the user', function () {
    equal(buildGrantRoles(["analyst", "auditor"], [USER("jo", "local")]),
          "GRANT ROLE `analyst`, `auditor` TO USER `jo`");
    equal(buildRevokeRoles(["analyst"], [USER("sam", "external")]),
          "REVOKE ROLE `analyst` FROM EXTERNAL USER `sam`");
  }],

  ['a grant reads as English in the table, not as DDL', function () {
    equal(describeTarget({Object: {ObjectType: "COLLECTION", DatabaseName: "db",
                                  ScopeName: "sales", ObjectName: "orders"}}),
          "collection db.sales.orders");
    equal(describeTarget({Object: {ObjectType: "COLLECTION", DatabaseName: "db"}}),
          "every collection in database db");
    equal(describeTarget({Object: {ObjectType: "LINK"}}), "every link");
  }],

  // ------------------------------------------------------------- the page

  ['the page joins roles, privileges, assignments and users', function () {
    const env = page();

    const roles = {};
    env.controller.roles.forEach(role => { roles[role.name] = role; });

    equal(roles.analyst.privileges.length, 1, 'the role keeps its grant');
    equal(roles.analyst.builtIn, false);
    equal(roles.sys_data_reader.builtIn, true, '@sys is what marks a built-in role');
    equal(roles.analyst.members.length, 1, 'and knows who holds it');

    const jo = env.controller.users.filter(u => u.id === "jo")[0];
    equal(jo.roles.length, 1);
    equal(jo.roles[0], "analyst");
  }],

  ['the page stands up without anything the workbench registers', function () {
    // The Security section can be the first thing a user opens. cbas.js - the
    // workbench's lazily loaded module - has not run then, and it is what
    // registers qwDialogService and qwQueryPlanService, which cwQueryService's
    // factory injects and its own module does not declare. A page that reached
    // through cwQueryService would fail to construct, and the whole tab would
    // render blank, buttons included.
    //
    // makeRbacEnv builds its injector from `ng`, this page's modules and a
    // stubbed $http, and nothing else, so merely getting this far proves the
    // page needs none of that. The assertions are just proof it really ran.
    const env = page();
    ok(env.controller.roles.length, 'the page loaded its roles');
    equal(env.controller.loading, false, 'and finished loading');
  }],

  ['ownership is not listed as a granted privilege', function () {
    // The engine writes one ownership row per object created. They are not
    // grants an administrator made or can revoke, and on a real instance they
    // would be the only thing visible.
    const env = page();
    const read = [];
    env.onHttp(function (config) {
      if (config.url === env.queryURL) {
        read.push(config.data.statement);
      }
      return env.$q.resolve({data: {results: []}});
    });
    env.controller.refresh();
    env.digest();
    ok(read.some(q => q.indexOf("Metadata.`Privilege`") >= 0 && q.indexOf("OWNERSHIP") >= 0),
       'the privileges read must exclude ownership:\n' + read.join('\n'));
  }],

  ['a grantee with no matching cluster user is shown as orphaned', function () {
    // The engine identifies a user by id, not by name, so such rows grant
    // nothing and a new user of the same name does not inherit them. They are
    // still the only sign the metadata is carrying leftovers, and the only
    // place they can be revoked outright.
    const env = page({users: [{id: "jo", domain: "local", name: "Jo"}]});
    const ghost = env.controller.users.filter(u => u.id === "ghost")[0];
    equal(ghost, undefined, 'nothing invented');

    const env2 = page({
      users: [],
      assignments: [{Assignee: "ghost", AssigneeDomain: "local",
                     GranteeType: "USER", AssignedRoleName: "analyst"}]
    });
    const found = env2.controller.users.filter(u => u.id === "ghost")[0];
    ok(found, 'a grantee with no cluster user still needs a row');
    equal(found.unknown, true);
  }],

  ['the purge names the account the grants were made to', function () {
    // Not the name they were made under: a live account may hold that name now.
    // The account is what the endpoint takes, in path segments, because a
    // DELETE's query string does not survive the trip to the servlet.
    const env = page({
      users: [],
      assignments: [{Assignee: "ghost", AssigneeDomain: "local", AssigneeId: "gone-uuid",
                     GranteeType: "USER", AssignedRoleName: "analyst"}]
    });
    const ghost = env.controller.users.filter(u => u.id === "ghost")[0];
    ok(ghost.unknown, 'the grantee has no cluster user');

    env.controller.purgeOrphanedGrants(ghost);
    env.digest();
    env.modal.ok();
    env.digest();

    contains(env.lastDelete(), "/local/ghost/gone-uuid");
    equal(env.controller.error, null, 'a purge that worked must not report a failure');
    equal(env.statements.length, 0, 'and it is not a statement any more');
  }],

  ['a grantee whose name needs encoding still names one account', function () {
    // ns_server accepts a good deal in a username, '/' included, and an
    // unencoded one would split into segments the servlet reads as a different
    // grantee entirely.
    const env = page({
      users: [],
      assignments: [{Assignee: "a/b c", AssigneeDomain: "external", AssigneeId: "u u",
                     GranteeType: "USER", AssignedRoleName: "analyst"}]
    });
    const ghost = env.controller.users.filter(u => u.id === "a/b c")[0];
    env.controller.purgeOrphanedGrants(ghost);
    env.digest();
    env.modal.ok();
    env.digest();

    contains(env.lastDelete(), "/external/a%2Fb%20c/u%20u");
  }],

  ['a superseded grantee is purged by its own account', function () {
    // The case the endpoint exists for. A revoke naming this user would be
    // applied to the account holding the name now and remove nothing.
    const env = page({
      users: [{id: "jo", domain: "local", name: "Jo", uuid: "new-uuid"}],
      assignments: [{Assignee: "jo", AssigneeDomain: "local", AssigneeId: "old-uuid",
                     GranteeType: "USER", AssignedRoleName: "analyst"}]
    });
    const gone = env.controller.users.filter(u => u.superseded)[0];
    ok(gone, 'the deleted account has a row of its own');

    env.controller.purgeOrphanedGrants(gone);
    env.digest();
    env.modal.ok();
    env.digest();

    contains(env.lastDelete(), "/local/jo/old-uuid");
    omits(env.lastDelete(), "new-uuid", 'the live account must not be named');
    equal(env.controller.error, null);
  }],

  ['a purge that removed nothing says so rather than failing', function () {
    // The rows went between the read and the click - the engine drops them
    // itself the next time it meets the name. Nothing failed, and a red banner
    // would say otherwise.
    const env = page({
      purgeRemoved: 0,
      users: [],
      assignments: [{Assignee: "ghost", AssigneeDomain: "local", AssigneeId: "gone-uuid",
                     GranteeType: "USER", AssignedRoleName: "analyst"}]
    });
    const ghost = env.controller.users.filter(u => u.id === "ghost")[0];
    env.controller.purgeOrphanedGrants(ghost);
    env.digest();
    env.modal.ok();
    env.digest();

    equal(env.controller.error, null, 'not a failure');
    contains(env.controller.notice, "already gone");
  }],

  ['a purge that fails reports it', function () {
    const env = page({
      purgeRemoved: null,
      users: [],
      assignments: [{Assignee: "ghost", AssigneeDomain: "local", AssigneeId: "gone-uuid",
                     GranteeType: "USER", AssignedRoleName: "analyst"}]
    });
    const ghost = env.controller.users.filter(u => u.id === "ghost")[0];
    env.controller.purgeOrphanedGrants(ghost);
    env.digest();
    env.modal.ok();
    env.digest();

    ok(env.controller.error, 'a real failure has to surface');
    contains(env.controller.error, "purge failed");
    equal(env.controller.notice, null);
  }],

  ['the purge dialog says everything goes, and shows no statement', function () {
    const env = page({
      users: [],
      privileges: [{
        Grantee: "ghost", GranteeType: "USER", GranteeDomain: "local", GranteeUuid: "gone-uuid",
        Privilege: "SELECT",
        Object: {ObjectType: "COLLECTION", DatabaseName: "db", ScopeName: "sales", ObjectName: "orders"}
      }]
    });
    const ghost = env.controller.users.filter(u => u.id === "ghost")[0];
    env.controller.purgeOrphanedGrants(ghost);
    env.digest();

    contains(env.modal.scope().options.message, "1 privilege(s)",
             'the dialog has to say that everything goes, not just this row');
    equal(env.modal.scope().options.statement, "",
          'this one is a REST call - showing DDL that will not run would be a lie');
  }],

  ['an orphaned row offers the purge, and not a per-row revoke', function () {
    // One click removes every row that user has, so a revoke link beside each
    // one describes something the engine will not do.
    // Both kinds of row, so both sub-tables render: a revoke link left behind
    // on either one describes something the engine will not do.
    const env = page({
      users: [],
      assignments: [{Assignee: "ghost", AssigneeDomain: "local", AssigneeId: "gone-uuid",
                     GranteeType: "USER", AssignedRoleName: "analyst"}],
      privileges: [{
        Grantee: "ghost", GranteeType: "USER", GranteeDomain: "local", GranteeUuid: "gone-uuid",
        Privilege: "SELECT",
        Object: {ObjectType: "COLLECTION", DatabaseName: "db", ScopeName: "sales", ObjectName: "orders"}
      }]
    });
    env.controller.openUsers["local:ghost"] = true;
    const root = env.renderPage();

    const labels = Array.from(root.querySelectorAll('button')).map(b => b.textContent.trim());
    ok(labels.indexOf('Purge Orphaned Grants') >= 0, 'the purge action: ' + labels.join(', '));
    equal(labels.indexOf('Edit Service Roles'), -1, 'nothing to edit on a user that is gone');

    const revokes = Array.from(root.querySelectorAll('a')).filter(a => a.textContent.trim() === 'revoke');
    equal(revokes.length, 0, 'no per-row revoke on an orphan');
  }],

  ['a role that owns no privileges but contains others is not shown as empty', function () {
    // sys_root owns not one Privilege row: everything it can do it can do
    // through the two roles under it, and the engine wires that up in memory
    // without writing an AssignedRole row. Counting its own rows says it has
    // no access at all, which is the opposite of what it is.
    const env = page({
      roles: [{RoleName: "sys_root", Creator: "@sys"},
              {RoleName: "sys_data_admin", Creator: "@sys"},
              {RoleName: "sys_security_admin", Creator: "@sys"}],
      privileges: [
        {Grantee: "sys_data_admin", GranteeType: "ROLE", Privilege: "INSERT",
         Object: {ObjectType: "COLLECTION"}},
        {Grantee: "sys_data_admin", GranteeType: "ROLE", Privilege: "DROP",
         Object: {ObjectType: "COLLECTION"}},
        {Grantee: "sys_security_admin", GranteeType: "ROLE", Privilege: "CREATE",
         Object: {ObjectType: "ROLE"}}
      ],
      assignments: []
    });
    const root = env.controller.roles.filter(r => r.name === "sys_root")[0];

    equal(root.privileges.length, 0, 'it really does own none');
    equal(root.effectivePrivileges, 3, 'but carries what the roles under it hold');
    ok(root.includedNames.indexOf("Service Data Admin") >= 0, 'named as the user sees them');
    ok(root.includedNames.indexOf("Service RBAC Admin") >= 0);

    // And they are listed, not just counted: a role whose row expands to
    // nothing is the one role whose privileges anybody wants to read.
    equal(root.allPrivileges.length, 3);
    equal(root.allPrivileges.filter(p => !p.via).length, 0, 'none are its own');
    const via = root.allPrivileges.map(p => p.via).sort();
    equal(via.join(","), "Service Data Admin,Service Data Admin,Service RBAC Admin",
          'each says which role it comes through');
  }],

  ['an inherited privilege cannot be revoked from the role that inherits it', function () {
    // Revoking has to name the role the grant is actually on; a revoke aimed
    // at the containing role would be rejected, having nothing to remove.
    const env = page({
      roles: [{RoleName: "auditor", Creator: "admin"}, {RoleName: "analyst", Creator: "admin"}],
      privileges: [
        {Grantee: "analyst", GranteeType: "ROLE", Privilege: "SELECT",
         Object: {ObjectType: "COLLECTION"}},
        {Grantee: "auditor", GranteeType: "ROLE", Privilege: "INSERT",
         Object: {ObjectType: "COLLECTION"}}
      ],
      assignments: [{Assignee: "auditor", GranteeType: "ROLE", AssignedRoleName: "analyst"}]
    });
    const auditor = env.controller.roles.filter(r => r.name === "auditor")[0];

    const own = auditor.allPrivileges.filter(p => !p.via);
    const inherited = auditor.allPrivileges.filter(p => p.via);
    equal(own.length, 1, 'its own INSERT');
    equal(own[0].grant.Privilege, "INSERT");
    equal(inherited.length, 1, "analyst's SELECT");
    equal(inherited[0].via, "analyst", 'and the template hides revoke on these');
  }],

  ['a role granted to another role is carried by it too', function () {
    // The metadata does record this half: GRANT ROLE a TO ROLE b writes an
    // AssignedRole row, so containment between custom roles is readable.
    const env = page({
      roles: [{RoleName: "analyst", Creator: "admin"}, {RoleName: "auditor", Creator: "admin"}],
      privileges: [{Grantee: "analyst", GranteeType: "ROLE", Privilege: "SELECT",
                    Object: {ObjectType: "COLLECTION"}}],
      assignments: [{Assignee: "auditor", GranteeType: "ROLE", AssignedRoleName: "analyst"}]
    });
    const auditor = env.controller.roles.filter(r => r.name === "auditor")[0];
    equal(auditor.effectivePrivileges, 1, 'auditor contains analyst');
    equal(auditor.includedNames[0], "analyst", 'a custom role has only its own name');
  }],

  ['containment that loops does not hang the page', function () {
    // The engine permits GRANT ROLE a TO ROLE b and b TO a - the rbac test
    // suite does exactly that - so walking the graph has to terminate.
    equal(rolesIncludedBy("a", {a: ["b"], b: ["a"]}).sort().join(","), "a,b");
  }],

  ['a role shows a name a person can read, and the one a GRANT takes', function () {
    // A built-in has both; a custom role has only its own name, and printing
    // it twice would fill a column with nothing.
    const env = page({
      roles: [{RoleName: "sys_data_admin", Creator: "@sys"},
              {RoleName: "analyst", Creator: "admin"}]
    });
    const byName = {};
    env.controller.roles.forEach(r => { byName[r.name] = r; });

    equal(byName.sys_data_admin.displayName, "Service Data Admin");
    equal(byName.sys_data_admin.label, "Service Data Admin (sys_data_admin)");
    equal(byName.analyst.displayName, "", 'nothing to add for a custom role');
    equal(byName.analyst.label, "analyst");
  }],

  ['the filter finds a built-in by either of its names', function () {
    // The table filters on the label, so "Data Admin" and "sys_data" both
    // reach the same row - someone reading the page and someone writing DDL
    // do not search for the same string.
    const env = page({roles: [{RoleName: "sys_data_admin", Creator: "@sys"}]});
    const label = env.controller.roles[0].label;
    ok(label.indexOf("Service Data Admin") >= 0, 'what a reader types');
    ok(label.indexOf("sys_data_admin") >= 0, 'what a grant-writer types');
  }],

  ['the RBAC admin role says what it cannot hand out', function () {
    // ensureRoleIsGrantable lets only a platform analytics admin grant
    // sys_root, and only sys_root or that same platform admin grant
    // sys_security_admin - so the role that administers RBAC cannot promote
    // anyone, itself included, to either. Worth saying where it is read.
    const env = page();
    const text = env.cwRbacService.roleDescription("sys_security_admin");
    contains(text, "Cannot grant Service Root");
    contains(text, "platform role");
  }],

  ['custom roles lead, and the built-ins follow by what they can do', function () {
    // The custom roles are what an administrator came to look at; the built-in
    // five are fixed furniture. Among the built-ins alphabetical would put
    // View Reader above Root, which is backwards for someone scanning to see
    // how much a role carries; among custom roles there is nothing to rank by,
    // so alphabetical is the only order that means anything.
    const env = page({
      roles: [{RoleName: "sys_view_reader", Creator: "@sys"},
              {RoleName: "analyst", Creator: "admin"},
              {RoleName: "sys_root", Creator: "@sys"},
              {RoleName: "auditor", Creator: "admin"},
              {RoleName: "sys_data_reader", Creator: "@sys"},
              {RoleName: "sys_security_admin", Creator: "@sys"},
              {RoleName: "sys_data_admin", Creator: "@sys"}],
      privileges: [],
      assignments: []
    });

    equal(env.controller.roles.map(r => r.name).join(","),
          "analyst,auditor," +
          "sys_root,sys_security_admin,sys_data_admin,sys_data_reader,sys_view_reader",
          'custom roles by name, then built-ins most capable first');
  }],

  ['a built-in role cannot be dropped or granted to', function () {
    const env = page();
    const builtIn = env.controller.roles.filter(r => r.name === "sys_data_reader")[0];
    equal(env.controller.isBuiltIn({Creator: "@sys"}), true);
    equal(builtIn.builtIn, true);
    // The template hides both actions on a built-in role; this is the value it
    // reads to do it.
  }],

  // ---------------------------------------------------------- grant dialog

  ['the grant dialog builds the statement the form describes', function () {
    const env = page();
    const scope = grantDialog(env, "COLLECTION", s => {
      s.options.privileges = {SELECT: true};
      s.options.targetKind = "SCOPE";
      s.options.target.database = "db";
      s.options.target.scope = "sales";
    });

    equal(scope.statement(), "GRANT SELECT ON ANY COLLECTION IN SCOPE `db`.`sales` TO ROLE `analyst`");

    env.modal.ok();
    equal(env.lastStatement(), scope.statement(), 'and sends it unchanged');
  }],

  ['changing the object type does not leave the old privileges ticked', function () {
    // CREATE is offered for both collections and links, so a tick that survives
    // the change is not merely stale - it silently builds GRANT CREATE LINK for
    // someone who was looking at collections.
    const env = page();
    const scope = grantDialog(env, "COLLECTION", s => {
      s.options.privileges = {CREATE: true};
      s.options.targetKind = "SCOPE";
      s.options.target.database = "db";
      s.options.target.scope = "sales";
    });
    contains(scope.statement(), "COLLECTION", 'a statement to start from');

    scope.options.objectType = "LINK";
    env.digest();
    equal(scope.options.privileges.CREATE, undefined, 'nothing is ticked for the new type');
    equal(scope.statement(), "", 'so there is nothing to grant yet');
    equal(scope.options.targetKind, "ANY", 'and the target form is back to the default');
  }],

  ['the dialog refuses to mix a DDL privilege with one on an object', function () {
    // They are two statements to the parser. Sent as one, the second privilege
    // is read as part of the first's object clause.
    const env = page();
    const scope = grantDialog(env, "COLLECTION", s => {
      s.options.privileges = {SELECT: true, CREATE: true};
    });
    equal(scope.mixesForms(), true);
    equal(scope.statement(), "", 'and builds nothing');
    equal(scope.isValid(), false, 'so the button cannot be pressed');
  }],

  ['the target forms offered are the ones the grammar accepts', function () {
    const env = page();
    const scope = grantDialog(env, "LINK", s => {
      s.options.privileges = {CONNECT: true};
    });
    const offered = scope.targetOptions;
    ok(offered.indexOf("ANY") >= 0 && offered.indexOf("NAME") >= 0, 'every link, or one link');
    equal(offered.indexOf("DATABASE"), -1, 'links are not scoped to a database');
    equal(offered.indexOf("SCOPE"), -1);
  }],

  ['the database picker offers what the instance actually has', function () {
    const env = page();
    const scope = grantDialog(env, "COLLECTION", s => {
      s.options.privileges = {SELECT: true};
      s.options.targetKind = "SCOPE";
    });
    equal(scope.databases.length, 1);
    equal(scope.databases[0], "db");

    scope.options.target.database = "db";
    env.digest();
    equal(scope.scopes.length, 1, 'and the scopes in the chosen database');
    equal(scope.scopes[0], "sales");
  }],

  ['ticking a privilege in the rendered form reaches the statement', function () {
    // Everything else here drives the model directly. This is the one case that
    // goes through the markup, because a checkbox bound to a model nothing
    // reads looks identical from the controller's side.
    const env = page();
    const scope = grantDialog(env, "COLLECTION");
    const root = env.render();

    const checkbox = root.querySelector('#rbac_privilege_SELECT');
    ok(checkbox, 'the SELECT checkbox');
    checkbox.click();
    env.digest();

    equal(scope.options.privileges.SELECT, true, 'the checkbox drives the model');
    contains(scope.statement(), "GRANT SELECT ON ANY COLLECTION TO ROLE `analyst`");
  }],

  ['a privilege can be granted straight to a user', function () {
    // The engine takes a user as a grantee just as it takes a role, and a user
    // who needs one grant nobody else needs should not force a role into
    // existence to hold it.
    const env = page();
    const scope = grantDialogForUser(env, "jo", "COLLECTION", s => {
      s.options.privileges = {SELECT: true};
      s.options.targetKind = "SCOPE";
      s.options.target.database = "db";
      s.options.target.scope = "sales";
    });

    equal(scope.statement(),
          "GRANT SELECT ON ANY COLLECTION IN SCOPE `db`.`sales` TO USER `jo`");

    env.modal.ok();
    equal(env.lastStatement(), scope.statement(), 'and sends it unchanged');
  }],

  ['granting to an external user says so, and the dialog says which one', function () {
    // An external and a local user can share a name and are different
    // accounts. A grant that omits EXTERNAL silently lands on the other one,
    // and the dialog is the last place to notice before it runs.
    const env = page();
    const scope = grantDialogForUser(env, "sam", "COLLECTION", s => {
      s.options.privileges = {SELECT: true};
    });

    equal(scope.statement(), "GRANT SELECT ON ANY COLLECTION TO EXTERNAL USER `sam`");
    contains(scope.options.granteeLabel, "external", 'the title has to distinguish the two');

    const heading = env.render().querySelector('h2');
    contains(heading.textContent, "sam");
  }],

  ['the same dialog grants to a role when a role opened it', function () {
    // One dialog, two principals: the grantee is passed in rather than derived,
    // so the risk is that one path quietly writes the other's clause.
    const env = page();
    const forRole = grantDialog(env, "COLLECTION", s => {
      s.options.privileges = {SELECT: true};
    });
    equal(forRole.statement(), "GRANT SELECT ON ANY COLLECTION TO ROLE `analyst`");
    equal(forRole.options.granteeLabel, "analyst");
  }],

  ['the user row offers to grant a privilege to that user', function () {
    // Everything else reaches the dialogs through the controller. This goes
    // through the page, because the button that opens this one is the part
    // that can be wired to nothing and look fine.
    const env = page();
    env.controller.openUsers["local:jo"] = true;
    const root = env.renderPage();

    const button = Array.from(root.querySelectorAll('button'))
      .filter(b => b.textContent.trim() === 'Grant Privilege')[0];
    ok(button, 'no Grant Privilege action on the user row');

    button.click();
    env.digest();
    equal(env.modal.scope().options.granteeLabel, "jo",
          'the button on a user row must open the dialog on that user');
  }],

  ['an unchosen database or scope says so rather than showing a blank', function () {
    // With nothing selected the model is "", which matches no option, so the
    // browser renders an empty row and the field reads as broken rather than
    // as waiting. The same placeholder idiom the catalog dialogs use.
    const env = page();
    grantDialog(env, "COLLECTION", s => {
      s.options.privileges = {SELECT: true};
      s.options.targetKind = "SCOPE";
    });
    const root = env.render();

    const first = id => root.querySelector('#' + id).options[0].textContent.trim();
    equal(first('rbac_database'), "-- Select Database --");
    equal(first('rbac_scope'), "-- Select Scope --");
  }],

  ['the statement is shown before it is run', function () {
    const env = page();
    grantDialog(env, "COLLECTION", s => {
      s.options.privileges = {SELECT: true};
      s.options.targetKind = "ANY";
    });
    const preview = env.render().querySelector('#rbac_grant_statement');
    ok(preview, 'the dialog shows the statement');
    contains(preview.textContent, "GRANT SELECT ON ANY COLLECTION TO ROLE `analyst`");
  }],

  // --------------------------------------------------------- assign dialog

  ['editing a user\'s roles grants what was ticked and revokes what was not', function () {
    const env = page({
      roles: [{RoleName: "analyst", Creator: "admin"}, {RoleName: "auditor", Creator: "admin"}]
    });
    const jo = env.controller.users.filter(u => u.id === "jo")[0];
    env.controller.editUserRoles(jo);
    const scope = env.modal.scope();
    env.digest();

    equal(scope.options.selected.analyst, true, 'what the user already holds is ticked');

    scope.options.selected.analyst = false;
    scope.options.selected.auditor = true;
    env.digest();

    contains(scope.statement(), "GRANT ROLE `auditor` TO USER `jo`");
    contains(scope.statement(), "REVOKE ROLE `analyst` FROM USER `jo`");

    env.modal.ok();
    ok(env.statements.some(s => s.indexOf("GRANT ROLE `auditor`") >= 0), 'the grant ran');
    ok(env.statements.some(s => s.indexOf("REVOKE ROLE `analyst`") >= 0), 'and the revoke');
  }],

  ['ticking nothing new leaves the Save button dead', function () {
    const env = page();
    const jo = env.controller.users.filter(u => u.id === "jo")[0];
    env.controller.editUserRoles(jo);
    const scope = env.modal.scope();
    env.digest();
    equal(scope.isValid(), false, 'no change, nothing to run');
    equal(scope.statement(), "");
  }],

  ['a role is created with the name typed, and a duplicate is refused', function () {
    const env = page();
    env.controller.addRole();
    const scope = env.modal.scope();
    env.digest();

    equal(scope.isTaken("analyst"), true, 'the existing role');
    equal(scope.isTaken("auditor"), false);

    scope.options.roleName = "auditor";
    env.digest();
    env.modal.ok();
    equal(env.lastStatement(), "CREATE ROLE `auditor`");
  }],

  ['dropping a role says how much goes with it', function () {
    const env = page();
    const analyst = env.controller.roles.filter(r => r.name === "analyst")[0];
    env.controller.dropRole(analyst);
    const scope = env.modal.scope();
    env.digest();

    contains(scope.options.message, "1 user(s) or role(s) will lose",
             'the warning has to name the blast radius');
    equal(scope.options.statement, "DROP ROLE `analyst`");

    env.modal.ok();
    equal(env.lastStatement(), "DROP ROLE `analyst`");
  }],

  ['a revoke from the table undoes exactly the grant on that row', function () {
    const env = page();
    const analyst = env.controller.roles.filter(r => r.name === "analyst")[0];
    env.controller.revokeGrant("analyst", analyst.privileges[0]);
    env.digest();
    env.modal.ok();
    equal(env.lastStatement(),
          "REVOKE SELECT ON COLLECTION `db`.`sales`.`orders` FROM ROLE `analyst`");
  }],

  ['cancelling a confirmation runs nothing', function () {
    const env = page();
    const analyst = env.controller.roles.filter(r => r.name === "analyst")[0];
    env.controller.dropRole(analyst);
    env.digest();
    env.modal.cancel();
    equal(env.statements.length, 0, 'a dismissed dialog must not have run its statement');
  }],

  // ---------------------------------------------------------- who may change it
  //
  // The tab is shown to anyone who may reach the service, because a service
  // role can carry the right to administer RBAC and no platform permission
  // says so. That makes the page responsible for deciding what to offer, and
  // getting it wrong either way is bad: too little locks an administrator out
  // of the only page that does this, too much offers actions the engine will
  // refuse.

  ['a platform role that can manage the service may change everything', function () {
    const env = page({canManage: true});
    equal(env.controller.canManage, true);
  }],

  ['a viewer with neither the platform permission nor a service role may not', function () {
    const env = page({canManage: false, whoami: {id: "jo", domain: "local"}});
    equal(env.controller.canManage, false, 'holding `analyst` grants nothing over RBAC');
  }],

  ['the service RBAC admin role is enough on its own', function () {
    // The whole point of the broadened nav gate: this user holds no platform
    // role beyond the access that lets them reach the service, and the engine
    // will accept their GRANTs.
    const env = page({
      canManage: false,
      whoami: {id: "sec", domain: "local"},
      assignments: [{Assignee: "sec", AssigneeDomain: "local",
                     GranteeType: "USER", AssignedRoleName: "sys_security_admin"}]
    });
    equal(env.controller.canManage, true);
  }],

  ['so is service root, and so is a custom role that was granted one', function () {
    const root = page({
      canManage: false,
      whoami: {id: "boss", domain: "local"},
      assignments: [{Assignee: "boss", AssigneeDomain: "local",
                     GranteeType: "USER", AssignedRoleName: "sys_root"}]
    });
    equal(root.controller.canManage, true, 'sys_root');

    // A role-to-role grant, which the engine follows and so must this.
    const indirect = page({
      canManage: false,
      whoami: {id: "jo", domain: "local"},
      assignments: [{Assignee: "jo", AssigneeDomain: "local",
                     GranteeType: "USER", AssignedRoleName: "analyst"},
                    {Assignee: "analyst", GranteeType: "ROLE",
                     AssignedRoleName: "sys_security_admin"}]
    });
    equal(indirect.controller.canManage, true, 'through the role they hold');
  }],

  ['the same name in the other domain is somebody else', function () {
    const env = page({
      canManage: false,
      whoami: {id: "sec", domain: "external"},
      assignments: [{Assignee: "sec", AssigneeDomain: "local",
                     GranteeType: "USER", AssignedRoleName: "sys_security_admin"}]
    });
    equal(env.controller.canManage, false,
          'a local grantee must not entitle the external account of that name');
  }],

  ['not knowing who is looking withholds the actions rather than offering them', function () {
    // /whoami is answered with a rejection when no viewer is seeded. Falling
    // back to the platform permission alone is the safe direction.
    const env = page({canManage: false});
    equal(env.controller.canManage, false);
  }],

  ['a read-only viewer is offered no action anywhere on the page', function () {
    const env = page({canManage: false, whoami: {id: "jo", domain: "local"}});
    env.controller.openRoles["analyst"] = true;
    env.controller.openUsers["local:jo"] = true;
    const root = env.renderPage();

    const labels = Array.from(root.querySelectorAll('button')).map(b => b.textContent.trim());
    equal(labels.length, 0, 'expected no buttons, got: ' + labels.join(', '));

    const links = Array.from(root.querySelectorAll('a')).map(a => a.textContent.trim());
    equal(links.indexOf('ADD SERVICE ROLE'), -1, 'nothing to add with');
    equal(links.indexOf('revoke'), -1, 'nothing to revoke with');
    ok(links.indexOf('REFRESH') >= 0, 'refresh is not a change and stays');

    contains(root.textContent, "read-only",
             'and the page has to say why the actions are missing');
  }],

  ['an administrator is offered them', function () {
    const env = page({canManage: true});
    env.controller.openRoles["analyst"] = true;
    env.controller.openUsers["local:jo"] = true;
    const root = env.renderPage();

    const labels = Array.from(root.querySelectorAll('button')).map(b => b.textContent.trim());
    ok(labels.indexOf('Drop Role') >= 0, 'the role actions: ' + labels.join(', '));
    ok(labels.indexOf('Edit Service Roles') >= 0, 'the user actions: ' + labels.join(', '));
    omits(root.textContent, "read-only", 'and no read-only notice');
  }],

  ['an empty page tells a read-only viewer it may not be the whole story', function () {
    const env = page({
      canManage: false, whoami: {id: "jo", domain: "local"},
      roles: [], privileges: [], assignments: [], users: []
    });
    const root = env.renderPage();
    contains(root.textContent, "not entitled to see",
             'an empty table must not read as an empty service');
    omits(root.textContent, "above to create one",
          'pointing at an action that is not there');
  }],

  ['a refused user list falls back to the engine\'s own', function () {
    // /settings/rbac/users needs cluster.admin.users!read, which the holder of
    // a service role that administers RBAC need not have. The engine publishes
    // the same list gated on those roles instead, so being refused by the
    // platform is not the end of it.
    const env = page({usersReadable: false});

    equal(env.controller.usersReadable, true, 'the fallback answered');
    ok(env.controller.users.some(u => u.id === "jo"), 'and the list is the real one');
    omits(env.renderPage().textContent, "user list could not be read");
  }],

  ['a viewer entitled to neither source is told so', function () {
    const env = page({usersReadable: false, engineUsers: null});

    equal(env.controller.usersReadable, false);
    contains(env.renderPage().textContent, "user list could not be read");
  }],

  ['the engine\'s list is asked for only once the platform has refused', function () {
    const asked = [];
    const env = page();
    env.onHttp(function (config) {
      if (config.url === env.queryURL) {
        asked.push(config.data.statement);
      }
      return undefined;
    });
    env.controller.refresh();
    env.digest();
    equal(asked.filter(q => q.indexOf("users()") >= 0).length, 0,
          'no need to ask the engine when the platform answered');
  }],

  ['an unreadable user list does not make every grantee an orphan', function () {
    // The orphaned badge carries a Purge action that removes every row the
    // grantee has. Deciding orphan-ness against a list that was never read
    // offers to destroy grants that are in force.
    const env = page({usersReadable: false, engineUsers: null,
                      whoami: {id: "sec", domain: "local"}});
    equal(env.controller.usersReadable, false, 'neither source answered');

    const jo = env.controller.users.filter(u => u.id === "jo")[0];
    ok(jo, 'the grantee is still listed: ' + env.controller.users.map(u => u.id).join(', '));
    equal(!!jo.unknown, false, 'and is not called orphaned on a list we never saw');

    env.controller.openUsers["local:jo"] = true;
    const labels = Array.from(env.renderPage().querySelectorAll('button'))
      .map(b => b.textContent.trim());
    equal(labels.indexOf('Purge Orphaned Grants'), -1,
          'no purge offered against grants that may be in force');
  }],

  ['the viewer is always listed, whatever else is refused', function () {
    // /whoami is registered no_check in ns_server, so the viewer's own account
    // is the one that survives every permission there is. Without it a viewer
    // who may not list users gets an empty table and no sight of what they
    // hold themselves.
    const env = page({usersReadable: false, engineUsers: null,
                      whoami: {id: "randy", domain: "local"}});

    const me = env.controller.users.filter(u => u.id === "randy")[0];
    ok(me, 'the viewer: ' + env.controller.users.map(u => u.id).join(', '));
    equal(me.self, true);
    equal(!!me.unknown, false, 'the account you are logged in as is not an orphan');
    contains(env.renderPage().textContent, "randy");
  }],

  ['the reads ask which account each grant was made to', function () {
    // Matching a grant to an account rather than to a name is only possible if
    // the id comes back with it. Nothing else on the page notices its absence -
    // every row simply looks live again.
    const read = [];
    const env = page();
    env.onHttp(function (config) {
      if (config.url === env.queryURL) {
        read.push(config.data.statement);
      }
      return env.$q.resolve({data: {results: []}});
    });
    env.controller.refresh();
    env.digest();

    const assignments = read.filter(q => q.indexOf("Metadata.`AssignedRole`") >= 0)[0];
    const privileges = read.filter(q => q.indexOf("Metadata.`Privilege`") >= 0)[0];
    contains(assignments, "a.AssigneeId", 'the role assignment read');
    contains(privileges, "p.GranteeUuid", 'the privilege read');
  }],

  ['a grant to a deleted account is not shown as the live user\'s', function () {
    // Delete a user and create another of the same name: the directory issues a
    // new id, and the rows left behind grant nothing. Matched on name they read
    // as live, revoke link and all.
    const env = page({
      users: [{id: "jo", domain: "local", name: "Jo", uuid: "new-uuid"}],
      assignments: [{Assignee: "jo", AssigneeDomain: "local", AssigneeId: "old-uuid",
                     GranteeType: "USER", AssignedRoleName: "analyst"}],
      privileges: [{Grantee: "jo", GranteeType: "USER", GranteeDomain: "local",
                    GranteeUuid: "old-uuid", Privilege: "SELECT",
                    Object: {ObjectType: "COLLECTION", DatabaseName: "db"}}]
    });

    const rows = env.controller.users.filter(u => u.id === "jo");
    equal(rows.length, 2, 'the live account and the one the grants were made to');

    const live = rows.filter(u => !u.superseded)[0];
    equal(live.roles.length, 0, 'the live user holds none of it');
    equal(live.privileges.length, 0);

    const gone = rows.filter(u => u.superseded)[0];
    equal(gone.roles.length, 1, 'the grants belong to the account that is gone');
    equal(gone.privileges.length, 1);
    equal(gone.unknown, true);

    contains(env.renderPage().textContent, "former account");
  }],

  // ------------------------------------------------- the service being down
  //
  // Every row on this page is read with a query, so an unreachable service is
  // not one failed field among many - it is the whole page. And it must not be
  // reported the way a refused statement is: one is a cluster to come back to,
  // the other is something the administrator did.

  ['an unreachable service is said plainly, not as a proxy error body', function () {
    const env = page({serviceDown: true});

    equal(env.controller.unavailable, true);
    equal(env.controller.error, null, 'no raw error banner on top of it');
    equal(env.controller.loading, false);

    const text = env.renderPage().textContent;
    contains(text, "could not be reached");
    omits(text, "not running on this node", 'the proxy body is not the message');
  }],

  ['503 from the proxy is the same story as 404', function () {
    equal(page({serviceDown: 503}).controller.unavailable, true);
  }],

  ['a statement the service refused is not called unreachable', function () {
    // The service answered; it said no. Telling the administrator to come back
    // later would be wrong, and would hide what it actually said.
    const env = page();
    env.onHttp(function (config) {
      return config.url === env.queryURL
        ? env.$q.resolve({data: {errors: [{code: 20001, msg: "Insufficient permissions"}]}})
        : undefined;
    });
    env.controller.refresh();
    env.digest();

    equal(env.controller.unavailable, false);
    contains(env.controller.error, "Insufficient permissions");
  }],

  ['a rejected response carrying the service\'s own errors is not unreachable', function () {
    // The discriminator is the errors array, not the status: the service can
    // answer with a non-2xx and still be the one answering. A 503 that carries
    // its errors came from the service; a 503 with a proxy's plain text did not.
    const env = page();
    env.onHttp(function (config) {
      return config.url === env.queryURL
        ? env.$q.reject({status: 503,
                         data: {errors: [{code: 20001, msg: "Insufficient permissions"}]}})
        : undefined;
    });
    env.controller.refresh();
    env.digest();

    equal(env.controller.unavailable, false, 'a status on its own settles nothing');
    contains(env.controller.error, "Insufficient permissions");
    omits(env.renderPage().textContent, "could not be reached");
  }],

  ['an unreachable service offers nothing to click but the retry', function () {
    const env = page({serviceDown: true});
    const root = env.renderPage();

    const labels = Array.from(root.querySelectorAll('button')).map(b => b.textContent.trim());
    equal(labels.length, 0, 'expected no buttons, got: ' + labels.join(', '));

    const links = Array.from(root.querySelectorAll('a')).map(a => a.textContent.trim());
    equal(links.indexOf('ADD SERVICE ROLE'), -1, 'nothing to add to');
    ok(links.indexOf('REFRESH') >= 0, 'the retry has to stay');
  }],

  ['the tables are not rendered empty behind the message', function () {
    // An empty table under an error reads as a cluster with no roles in it.
    const env = page({serviceDown: true});
    const text = env.renderPage().textContent;
    omits(text, "No service roles to display");
    omits(text, "No users to display");
  }],

  ['a count of nothing reads as a dash, not as a zero', function () {
    const env = page({
      roles: [{RoleName: "empty", Creator: "admin"}],
      privileges: [], assignments: [],
      users: [{id: "jo", domain: "local", name: "Jo"}]
    });
    const root = env.renderPage();
    const text = root.textContent;
    omits(text, "0", 'a bare zero anywhere in the tables: ' + text.replace(/\s+/g, ' '));
    contains(text, "\u2014");
  }],

  ['a count of something still reads as the number', function () {
    const env = page();
    const root = env.renderPage();
    const analyst = env.controller.roles.filter(r => r.name === "analyst")[0];
    equal(analyst.privileges.length, 1);
    equal(analyst.members.length, 1);
    contains(root.textContent, "1");
  }],

  ['a superseded grantee is offered the purge, which now names the account', function () {
    // It used to be withheld: the purge was a revoke naming the user, and where
    // a live account held the name it removed nothing and reported success. The
    // endpoint takes the account, so the action means what it says.
    const env = page({
      users: [{id: "jo", domain: "local", name: "Jo", uuid: "new-uuid"}],
      assignments: [{Assignee: "jo", AssigneeDomain: "local", AssigneeId: "old-uuid",
                     GranteeType: "USER", AssignedRoleName: "analyst"}]
    });
    const gone = env.controller.users.filter(u => u.superseded)[0];
    env.controller.openUsers[gone.key] = true;

    const labels = Array.from(env.renderPage().querySelectorAll('button'))
      .map(b => b.textContent.trim());
    ok(labels.indexOf('Purge Orphaned Grants') >= 0, 'the purge: ' + labels.join(', '));
  }],

  ['a grantee whose account the metadata does not record is not offered it', function () {
    // The endpoint is addressed by account. Without one there is nothing to
    // name, and a button that cannot say what it would delete is worse than none.
    const env = page({
      users: [],
      assignments: [{Assignee: "ghost", AssigneeDomain: "local",
                     GranteeType: "USER", AssignedRoleName: "analyst"}]
    });
    const ghost = env.controller.users.filter(u => u.id === "ghost")[0];
    equal(ghost.uuid, undefined, 'no account on the row');
    env.controller.openUsers[ghost.key] = true;

    const labels = Array.from(env.renderPage().querySelectorAll('button'))
      .map(b => b.textContent.trim());
    equal(labels.indexOf('Purge Orphaned Grants'), -1,
          'expected no purge, got: ' + labels.join(', '));
  }],

  ['a grantee no live account has taken over still offers the purge', function () {
    const env = page({
      users: [],
      assignments: [{Assignee: "ghost", AssigneeDomain: "local", AssigneeId: "gone-uuid",
                     GranteeType: "USER", AssignedRoleName: "analyst"}]
    });
    const ghost = env.controller.users.filter(u => u.id === "ghost")[0];
    equal(!!ghost.superseded, false, 'nobody holds the name');
    env.controller.openUsers[ghost.key] = true;

    const labels = Array.from(env.renderPage().querySelectorAll('button'))
      .map(b => b.textContent.trim());
    ok(labels.indexOf('Purge Orphaned Grants') >= 0, 'the purge: ' + labels.join(', '));
  }],

  ['an external grantee is matched by name, as the engine matches it', function () {
    // ns_server issues no uuid for an external user, so the engine mints one and
    // stores it only in its own metadata. There is nothing to compare against,
    // and treating a missing uuid as a mismatch would orphan every external
    // grantee on the cluster.
    const env = page({
      users: [{id: "sam", domain: "external", name: "Sam"}],
      assignments: [{Assignee: "sam", AssigneeDomain: "external", AssigneeId: "engine-minted",
                     GranteeType: "USER", AssignedRoleName: "analyst"}]
    });

    const rows = env.controller.users.filter(u => u.id === "sam");
    equal(rows.length, 1, 'one row, not an orphan beside a live user');
    equal(rows[0].roles.length, 1);
    equal(!!rows[0].superseded, false);
    equal(!!rows[0].unknown, false);
  }],

  ['two rows for one name do not collide in the table', function () {
    // domain and name used to be the repeater's key. Two rows sharing it make
    // AngularJS throw rather than render, which is a blank page, not a bad one.
    const env = page({
      users: [{id: "jo", domain: "local", name: "Jo", uuid: "new-uuid"}],
      assignments: [{Assignee: "jo", AssigneeDomain: "local", AssigneeId: "old-uuid",
                     GranteeType: "USER", AssignedRoleName: "analyst"}]
    });
    const keys = env.controller.users.map(u => u.key);
    equal(new Set(keys).size, keys.length, 'keys must be unique: ' + keys.join(', '));

    const root = env.renderPage();
    const cells = Array.from(root.querySelectorAll('.cbui-tablerow'))
      .filter(r => r.textContent.indexOf('jo') >= 0);
    ok(cells.length >= 2, 'both rows render: ' + cells.length);
  }],

  ['a readable list still calls a grantee it does not hold an orphan', function () {
    const env = page({
      whoami: {id: "jo", domain: "local"},
      users: [{id: "jo", domain: "local", name: "Jo"}],
      assignments: [{Assignee: "ghost", AssigneeDomain: "local",
                     GranteeType: "USER", AssignedRoleName: "analyst"}]
    });
    const ghost = env.controller.users.filter(u => u.id === "ghost")[0];
    equal(ghost.unknown, true);
    equal(env.controller.users.filter(u => u.id === "jo")[0].self, true);
  }],

];
