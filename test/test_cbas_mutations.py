#!/usr/bin/env python3
"""Tests for test_cbas_dialogs.py: each case here breaks cbas-ui on purpose.

A test that cannot fail is worse than no test, because it reads as coverage.
Every entry below removes or corrupts one decision the dialogs make, copies the
UI tree with that damage in place, and asserts that some case in
test/cbas/cases.js notices. A mutation that no longer applies is a failure
too - otherwise it quietly stops testing anything the day the code it patches
is reworded.

    python3 test/test_cbas_mutations.py

Same requirements as test_cbas_dialogs.py: playwright and the sibling cbas-ui
checkout. One browser serves the whole run.
"""

import argparse
import os
import shutil
import sys
import tempfile
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import junit_xml
import test_cbas_dialogs

# (name, file, text to find, what to replace it with). The name says what the
# product would then do wrong, not which line moved.
MUTATIONS = [
    ('a vending catalog no longer says so in its DDL',
     'cw_query_service.js',
     """    if (options.vendedCredentials) {
      withOptions.push('"vendedCredentials": "true"');
    }""",
     ''),

    ('a vending collection is still created AT a link',
     'cw_cbas_controller.js',
     """(opts.vendedCredentials ? `` : ` AT \\`${opts.selectedLink}\\``) +""",
     """` AT \\`${opts.selectedLink}\\`` +"""),

    ('the vending property is read raw from the metadata, not as a string',
     'cw_query_service.js',
     """VendedCredentials: String(record.VendedCredentials).toLowerCase() === "true\"""",
     """VendedCredentials: record.VendedCredentials"""),

    ('the metadata query stops asking for the vending property',
     'cw_constants_service.js',
     """  )[0] AS VendedCredentials, ""","""  )[0] AS NotVendedCredentials, """),

    ('the "Other" signing region reaches the server literally',
     'cw_query_service.js',
     """      if (key === "sigv4SigningRegion" && value === "Other") {
        value = options.other_sigv4_region;
      }""",
     ''),

    ('a source that cannot vend keeps the vending flag it was left with',
     'cw_cbas_controller.js',
     """        if (!createNewCatalogDialogScope.sourceCanVendCredentials()) {
          createNewCatalogDialogScope.options.vendedCredentials = false;
        }""",
     ''),

    ('a catalog that does not vend keeps the vending flag it was left with',
     'cw_cbas_controller.js',
     """          if (!dialogScope.catalogVendsCredentials()) {
            dialogScope.options.vendedCredentials = false;
          }""",
     ''),

    ('the signing region is no longer preselected from the link',
     'cw_cbas_controller.js',
     """        if (createNewCatalogDialogScope.getAwsRegions().indexOf(info.region) >= 0) {""",
     """        if (false) {"""),

    ('the signing name is left pointing at an option the select lost',
     'cw_cbas_controller.js',
     """        createNewCatalogDialogScope.options.catalog_params.sigv4SigningName = "glue";""",
     ''),

    ('vending is offered by every catalog source, not only the REST ones',
     'cw_cbas_controller.js',
     """        return cwConstantsService.icebergVendingEnabled
          && cwConstantsService.vendedCredentialsCatalogSources
            .indexOf(createNewCatalogDialogScope.options.catalog_source) >= 0;""",
     """        return cwConstantsService.icebergVendingEnabled;"""),

    ('the feature flag stops hiding the option',
     'cw_constants_service.js',
     """  cwConstantsService.icebergVendingEnabled = false;""",
     """  cwConstantsService.icebergVendingEnabled = true;"""),

    ('a source in the vending list is spelled in a way nothing matches',
     'cw_constants_service.js',
     '''"S3_TABLES", "BIGLAKE_METASTORE"]''',
     '''"S3_TABLE", "BIGLAKE_METASTORE"]'''),

    # The markup half. An ng-if naming a function the scope does not have is
    # simply always false, so the option silently never appears - nothing but a
    # rendered template can catch it.
    ('the catalog checkbox is guarded by a scope function that does not exist',
     'cw_cbas_catalog_dialog.html',
     """ng-if="sourceCanVendCredentials()\"""",
     """ng-if="sourceCanVendCredential()\""""),

    ('the collection checkbox writes to a model nothing reads',
     'cw_cbas_iceberg_collection_dialog.html',
     """          ng-model="options.vendedCredentials"
          type="checkbox">""",
     """          ng-model="options.vendCredentials"
          type="checkbox">"""),

    ('a vending collection still demands a link in the form',
     'cw_cbas_iceberg_collection_dialog.html',
     """                ng-required="!options.vendedCredentials"
                ng-disabled="options.vendedCredentials\"""",
     ''),

    # Service RBAC. Every one of these produces a statement the server accepts
    # and executes - just not the grant the form described - so nothing but an
    # assertion on the statement notices.
    ('a backtick in a name is no longer escaped',
     'cw_rbac_service.js',
     """  return "`" + String(name == null ? "" : name).replace(/`/g, "``") + "`";""",
     """  return "`" + String(name == null ? "" : name) + "`";"""),

    ('an external user is granted as the local user of the same name',
     'cw_rbac_service.js',
     """  var domain = String(grantee.domain || "local").toLowerCase() === "external" ? "EXTERNAL " : "";
  return domain + "USER " + quoteId(grantee.name);""",
     """  return "USER " + quoteId(grantee.name);"""),

    ('a role grantee is written as a bare name, which means something else',
     'cw_rbac_service.js',
     """    return "ROLE " + quoteId(grantee.name);""",
     """    return quoteId(grantee.name);"""),

    ('a privilege over objects not yet created grows an ON',
     'cw_rbac_service.js',
     """    return " " + objectTypeKey + scopeClause;""",
     """    return " ON " + objectTypeKey + scopeClause;"""),

    ('an index grant drops the collections it applies to',
     'cw_rbac_service.js',
     """    return " INDEX ON ANY COLLECTION" + scopeClause;""",
     """    return " INDEX" + scopeClause;"""),

    ('a two-word privilege can be written with no object to disambiguate it',
     'cw_rbac_service.js',
     """      if (TWO_WORD_PRIVILEGES.indexOf(privilege) >= 0) {
        throw new Error(privilege + " is a privilege on an object and cannot be granted without one");
      }""",
     ''),

    ('a target form the grammar rejects is written anyway',
     'cw_rbac_service.js',
     """  if (targetsFor(objectTypeKey, isDdl).indexOf(targetKind) < 0) {
    throw new Error("a " + (isDdl ? "DDL" : "") + " privilege on " + objectTypeKey +
                    " cannot be targeted " + targetKind);
  }""",
     ''),

    ('a stored grant is revoked at the wrong scope',
     'cw_rbac_service.js',
     """  if (target.ScopeName) {
    return "SCOPE";
  }""",
     ''),

    ('ownership rows flood the list of granted privileges',
     'cw_rbac_service.js',
     """FROM Metadata.`Privilege` AS p WHERE p.Privilege != 'OWNERSHIP'""",
     """FROM Metadata.`Privilege` AS p"""),

    ('a grantee holding grants but no cluster user is dropped from the page',
     'cw_rbac_controller.js',
     """      var key = granteeKey(name, "USER", domain) + "#" + (granteeId || "");""",
     """      var key = granteeKey(name, "USER", domain) + "#" + (granteeId || "");
      if (!live) { return {id: name, domain: domain, roles: [], privileges: []}; }"""),

    ('the privileges ticked survive a change of object type',
     'cw_rbac_controller.js',
     """      if (newType !== oldType) {
        options.privileges = {};
        options.targetKind = "ANY";
      }""",
     ''),

    ('the RBAC page depends on the workbench again, and is blank without it',
     'cw_rbac_service.js',
     """  .factory("cwRbacService", ["$q", "$http", "cwConstantsService", cwRbacServiceFactory]);""",
     """  .factory("cwRbacService", ["$q", "$http", "cwConstantsService", "cwQueryService", cwRbacServiceFactory]);"""),

    ('a grant to a user is written as a grant to a role of that name',
     'cw_rbac_controller.js',
     """    grantPrivilege({name: user.id, type: "USER", domain: user.domain}, granteeLabel(user));""",
     """    grantPrivilege({name: user.id, type: "ROLE"}, granteeLabel(user));"""),

    ('an external user is granted to as though they were local',
     'cw_rbac_controller.js',
     """    grantPrivilege({name: user.id, type: "USER", domain: user.domain}, granteeLabel(user));""",
     """    grantPrivilege({name: user.id, type: "USER"}, granteeLabel(user));"""),

    # The markup half. A checkbox bound to a model nothing reads simply never
    # ticks anything, and no assertion short of a rendered template sees it.
    ('the user row loses the action that grants to that user',
     'cbas_rbac.html',
     """<button class="outline" ng-click="rbacCtl.grantToUser(user)">Grant Privilege</button>""",
     ''),

                # The grantee-scoped purge. It is addressed by account, and every segment of
    # that address has to survive the trip intact.
    ('a grantee name is not encoded into its path segment',
     'cw_rbac_service.js',
     """          encodeURIComponent(grantee.id), encodeURIComponent(grantee.uuid)].join("/");""",
     """          grantee.id, encodeURIComponent(grantee.uuid)].join("/");"""),

    ('the purge names the grantee without saying which account',
     'cw_rbac_service.js',
     """          encodeURIComponent(grantee.id), encodeURIComponent(grantee.uuid)].join("/");""",
     """          encodeURIComponent(grantee.id), ""].join("/");"""),

    ('a purge that removed nothing is reported as a failure',
     'cw_rbac_controller.js',
     """          if (!removed && rows) {""",
     """          if (removed && rows) {"""),

    ('a superseded grantee is denied the purge again',
     'cbas_rbac.html',
     """<span ng-if="rbacCtl.canManage && user.unknown && user.uuid">""",
     """<span ng-if="rbacCtl.canManage && user.unknown && user.uuid && !user.superseded">"""),

    ('an orphan keeps a per-row revoke that removes more than the row',
     'cbas_rbac.html',
     """<a ng-if="rbacCtl.canManage && !user.unknown"
                     ng-click="rbacCtl.revokeGrant(user.id, grant)">revoke</a>""",
     """<a ng-if="rbacCtl.canManage"
                     ng-click="rbacCtl.revokeGrant(user.id, grant)">revoke</a>"""),

    # Who may change any of this. The tab is shown to anyone who may reach the
    # service, so these decisions are the only thing between a read-only viewer
    # and a page full of actions the engine would refuse - and between an
    # administrator who holds only a service role and a page with none.
    ('a read-only viewer is offered every action anyway',
     'cw_rbac_controller.js',
     """      rbacCtl.canManage = canManage(data.whoami, data.assignments, includedByRole);""",
     """      rbacCtl.canManage = true;"""),

    ('an administrator who holds only a service role is offered none',
     'cw_rbac_controller.js',
     """    return cwRbacService.holdsAdminServiceRole(
      rolesHeldBy(whoami, assignmentRows), includedByRole);""",
     """    return false;"""),

    ('the viewer is matched by name alone, so the other domain\'s account counts',
     'cw_rbac_controller.js',
     """        row.Assignee === whoami.id &&
        String(row.AssigneeDomain || "local").toLowerCase() ===
          String(whoami.domain || "local").toLowerCase();""",
     """        row.Assignee === whoami.id;"""),

    ('a role that was granted an administering role stops carrying it',
     'cw_rbac_service.js',
     """    return isAdminServiceRole(name) ||
      rolesIncludedBy(name, grantedRoleNamesByRole).some(isAdminServiceRole);""",
     """    return isAdminServiceRole(name);"""),

    ('a grantee is called orphaned on a user list that was never read',
     'cw_rbac_controller.js',
     """          unknown: usersReadable,""",
     """          unknown: true,"""),

        ('the viewer drops off the page when the user list is refused',
     'cw_rbac_controller.js',
     """    if (whoami) {
      var self = ensure(whoami.id, whoami.domain);
      self.unknown = false;
      self.self = true;
    }""",
     """    if (false) {
      ensure(whoami.id, whoami.domain);
    }"""),

    # Matching a grant to an account rather than to a name. Both directions are
    # wrong in their own way: one shows a dead grant as live, the other orphans
    # every external grantee on the cluster.
    ('a grant left by a deleted account is shown as the live user\'s',
     'cw_rbac_controller.js',
     """      return !!(user.uuid && granteeId && user.uuid !== granteeId);""",
     """      return false;"""),

    ('a grantee with no directory uuid is treated as a mismatch',
     'cw_rbac_controller.js',
     """      return !!(user.uuid && granteeId && user.uuid !== granteeId);""",
     """      return user.uuid !== granteeId;"""),

    ('the grant no longer says which account it was made to',
     'cw_rbac_service.js',
     """    "SELECT a.Assignee, a.AssigneeDomain, a.AssigneeId, a.GranteeType, a.AssignedRoleName " +""",
     """    "SELECT a.Assignee, a.AssigneeDomain, a.GranteeType, a.AssignedRoleName " +"""),

    ('the page gives up when the platform refuses its user list',
     'cw_rbac_service.js',
     """    }, function () {
      return query(USERS_QUERY).then(function (rows) {
        return rows.map(toUser);
      });
    });""",
     """    });"""),

    ('two rows for one name collide in the table',
     'cbas_rbac.html',
     """track by user.key""",
     """track by (user.domain + ':' + user.id)"""),

    ('a count of nothing is shown as a bare zero',
     'cbas_rbac.html',
     """            <span ng-if="user.privileges.length">{{user.privileges.length}}</span>
            <span class="grayblack-3" ng-if="!user.privileges.length">&mdash;</span>""",
     """            <span>{{user.privileges.length}}</span>"""),

    # An unreachable service. Reported as whatever the proxy put in the body, or
    # not told apart from a statement the service refused, and the administrator
    # is sent looking for a mistake they did not make.
    ('an unreachable service is reported as a refused statement',
     'cw_rbac_service.js',
     """        error.unavailable = !errors && SERVICE_DOWN_STATUSES.indexOf(error.status) >= 0;""",
     """        error.unavailable = false;"""),

    ('a statement the service refused is called unreachable',
     'cw_rbac_service.js',
     """        error.unavailable = !errors && SERVICE_DOWN_STATUSES.indexOf(error.status) >= 0;""",
     """        error.unavailable = true;"""),

    ('the tables render empty behind the unreachable message',
     'cbas_rbac.html',
     """  <div ng-if="!rbacCtl.loading && !rbacCtl.unavailable">""",
     """  <div ng-if="!rbacCtl.loading">"""),

    ('a read-only page stops saying why its actions are missing',
     'cbas_rbac.html',
     """    <p class="text-small grayblack-3 margin-bottom-half" ng-if="!rbacCtl.canManage">""",
     """    <p class="text-small grayblack-3 margin-bottom-half" ng-if="false">"""),

    ('the privilege checkbox writes to a model nothing reads',
     'cw_rbac_grant_dialog.html',
     """             ng-model="options.privileges[privilege.privilege]">""",
     """             ng-model="options.privilege[privilege.privilege]">"""),
]


def mutate(cbas_ui, filename, old, new):
    """Copy the cbas-ui tree with one change applied; None if the text is gone."""
    root = os.path.join(tempfile.mkdtemp(), 'cbas-ui')
    shutil.copytree(cbas_ui, root)
    path = os.path.join(root, filename)
    with open(path, encoding='utf-8') as fh:
        text = fh.read()
    if old not in text:
        shutil.rmtree(os.path.dirname(root))
        return None
    with open(path, 'w', encoding='utf-8') as fh:
        fh.write(text.replace(old, new, 1))
    return root


def main():
    parser = test_cbas_dialogs.add_arguments(argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter))
    args = parser.parse_args()

    if not test_cbas_dialogs.check_cbas_ui(args.cbas_ui):
        return 1

    cases = []
    with test_cbas_dialogs.browser() as instance:
        # The real tree has to pass first. Without this a mutation that fails
        # for some unrelated reason would still be reported as detected.
        started = time.time()
        baseline = [name for name, failure, _ in
                    test_cbas_dialogs.run(instance, args.cbas_ui)
                    if failure]
        cases.append(('unmodified tree passes',
                      'these cases fail before any mutation:\n  ' + '\n  '.join(baseline)
                      if baseline else None,
                      time.time() - started))

        for name, filename, old, new in MUTATIONS:
            started = time.time()
            root = mutate(args.cbas_ui, filename, old, new)
            if root is None:
                cases.append((name, f'this mutation no longer applies: the text it '
                                    f'replaces is gone from {filename}. Update it, or '
                                    f'it is testing nothing.', time.time() - started))
                continue
            try:
                failures = [case for case, failure, _ in
                            test_cbas_dialogs.run(instance, root) if failure]
            finally:
                shutil.rmtree(os.path.dirname(root))
            cases.append((name,
                          None if failures else 'no case failed; this breakage would ship',
                          time.time() - started))

    failed = 0
    for name, failure, _ in cases:
        if failure:
            failed += 1
            print(f'FAIL  {name}')
            for line in failure.splitlines():
                print(f'      {line}')
        else:
            print(f'ok    caught: {name}')

    if args.junit_xml:
        junit_xml.write(args.junit_xml, 'ui.cbas_mutations', cases)

    print()
    if failed:
        print(f'{failed} of {len(cases)} mutations went undetected')
        return 1
    print(f'all {len(cases) - 1} mutations detected')
    return 0


if __name__ == '__main__':
    sys.exit(main())
