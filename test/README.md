# UI tests

Tests for the Enterprise Analytics UI fork. They live here, outside `src/ui`,
because CMake symlinks the whole of `src/ui` into the build output — anything
placed under it ships to customers.

## Layers

| | What it needs | What it catches |
|---|---|---|
| `check_ui.py` | python3 | Structural breakage: dangling imports, missing assets, DI mismatches, links to removed pages |
| `test_check_ui.py` | python3 | That `check_ui.py` still fails when it should |
| `test_ui_smoke.py --serve-source` | docker (or local playwright) | The app failing to boot, or asking at runtime for a module/template that no longer exists |
| `test_cbas_dialogs.py` | docker (or local playwright) + `../cbas-ui` | The analytics workbench's dialogs, and the Security section's Service RBAC page, building the wrong statement or showing the wrong fields |
| `test_cbas_mutations.py` | docker (or local playwright) + `../cbas-ui` | A case in `test_cbas_dialogs.py` that can no longer fail |
| `test_ui_smoke.py --url ...` | playwright + a cluster | Nav contents, every live route loading clean, removed pages not rendering |

### `check_ui.py` — structural checks

```
python3 test/check_ui.py            # run everything
python3 test/check_ui.py --list     # describe each check
```

Exits non-zero on the first failing check. No cluster, no browser, no network,
no `npm install`, runs in about a second — cheap enough for every patchset.

Every check exists because that exact breakage reached a build or a review:

- **importmap targets exist** — entries pointing at deleted files.
- **js imports resolve** — including *inside* `web_modules/`. Snowpack names those
  bundles by content hash and renames them on regeneration; `patch(1)` cannot
  apply git renames, so contents can land under the old names while every
  importing module points at the new ones.
- **css imports resolve** — `index.css` pulls in `libs/` and `app/css/`. A stale
  `@import` here fails the product build in `minify_css`, not in any JS tooling.
- **runtime template urls resolve** — `ng-include`, `uib-tooltip-template`,
  `uib-popover-template` and `templateUrl` name their templates in plain
  strings fetched at runtime. Nothing at build time notices when the target is
  deleted; the page just renders an empty tooltip in production.
- **entry-point assets exist** — `index.html` / `index-dev.html` stylesheets and scripts.
- **angularjs DI annotations match signatures** — these are positional. Dropping a
  service from the annotation array but not the signature silently shifts every
  parameter after it instead of failing loudly.
- **router links point at registered states** — a nav link left pointing at a page
  that was removed. HTML comments are stripped first, since this fork disables
  pages by commenting the nav entry out.
- **html comments balanced** — an unbalanced `<!-- -->` silently swallows live
  markup. Easy to cause when deleting a disabled nav entry whose closing `-->`
  shares a line with the markup being removed.
- **no unexpected orphans** — dead code left behind by a page removal, and the
  reverse: it fails if a file is deleted on "nothing imports it" grounds when
  something loads it by URL instead.

Two allowlists in the script carry the exceptions, each with a reason:
`INTENTIONALLY_UNREACHABLE` (files with no importer that must not be deleted —
`libs/ace/**` is loaded by query-ui and cbas-ui, not from here) and
`EXTERNAL_IMPORTS` / `EXTERNAL_STATES` (owned by ns_server or the pluggable UIs).
When a check fires and the answer really is "that's expected", add it there with
the reason rather than weakening the check.

### `test_check_ui.py` — tests for the checks

```
python3 test/test_check_ui.py
```

Copies the UI tree to a temporary directory, reintroduces a defect that actually
happened, and asserts the matching check fails. A check that cannot fail is
worse than no check, because it reads as coverage. It also asserts the
unmodified tree passes, and treats a mutation that no longer applies as a
failure — otherwise a case silently drifts into testing nothing.

### `test_ui_smoke.py` — browser smoke tests

```sh
pip install playwright && playwright install chromium
```

Both modes load **`index-dev.html`** by default. CMake symlinks `src/ui` into the
build output, so that entry point runs the working tree as-is — no `make install`
between an edit and a test run. Pass `--entry index.html` to exercise the built,
minified bundle instead.

**Hermetic** — serves `src/ui` with a stub REST API, no cluster:

```sh
python3 test/test_ui_smoke.py --serve-source
```

It asserts only two things, because only two can be asserted honestly against a
stub: the app bootstraps, and every module and template it requests exists.
Reproducing ns_server's auth semantics well enough to reach a signed-in UI would
mean reimplementing ns_server, and a stub that is subtly wrong is worse than no
stub. Those two are still the failures the product build misses entirely — a
dangling ES import or a template fetched by URL that was deleted.

**Against a cluster** — the full suite. Add `--wizard` to configure a *fresh,
uninitialised* cluster through the setup wizard instead of signing in to one
that is already set up; the blob storage details are then supplied through
`mn-columnar-bucket-config` rather than REST, so a break in the wizard fails
the test instead of being bypassed:

```sh
python3 test/test_ui_smoke.py --url http://127.0.0.1:9000 --wizard \
    --user couchbase --password couchbase \
    --s3-endpoint http://127.0.0.1:9090 --s3-bucket ea-it-bucket
```

`--s3-endpoint` is the endpoint **as the cluster sees it**, which is not
necessarily what the test host would use.

Signing in to an existing cluster:

```sh
python3 test/test_ui_smoke.py --url http://127.0.0.1:8091 \
    --user Administrator --password <password>
```

> The cluster **must** run the analytics profile (`analytics_profile`) with an
> s3mock backing store. This UI is not compatible with `default_profile`; the
> test checks `prodName` up front and stops with a clear message rather than
> failing obscurely a dozen assertions later.

On top of the hermetic checks it asserts: sign-in reaches the admin UI; the nav
shows exactly Dashboard, Servers, Security, Settings, Logs and Workbench; each
live route loads with no console errors or failed requests; each removed route
(`/replications`, `/views`, `/buckets`, `/collections`, `/index`,
`/settings/sampleBuckets`, `/settings/autoCompaction`) bounces to the dashboard
instead of rendering; and the encryption-status tooltip template is still served.

`EXPECTED_NAV`, `LIVE_ROUTES` and `REMOVED_ROUTES` at the top of the file are the
knobs to update when a page is added or removed.

### Analytics workbench

`--workbench` adds six checks that drive the cbas-ui workbench rather than its
REST API, so a break in the editor, the execute button or the results pane
fails the test instead of being bypassed:

1. the workbench loads (i.e. the cbas pluggable UI is installed)
2. `SELECT 1;` runs and returns `{"$1": 1}`
3. the samples page offers travel-sample
4. travel-sample installs — polled via `/_p/cbas/api/v1/samples` until the
   server stops offering it, which is the only completion signal the UI has
5. the five standalone (`INTERNAL`) collections it creates exist
6. one of them is queryable — `SELECT VALUE COUNT(*)` returns a positive count

It is opt-in because installing the sample takes about a minute and mutates the
cluster. `WORKBENCH_SAMPLE` / `SAMPLE_COLLECTIONS` near the top of the file are
the knobs.

### `test_cbas_dialogs.py` — the analytics workbench's dialogs

```sh
python3 test/test_cbas_dialogs.py                         # ../../cbas-ui/cbas-ui
python3 test/test_cbas_dialogs.py --cbas-ui path/to/cbas-ui/cbas-ui
```

The workbench is a pluggable UI in the sibling `cbas-ui` project, but the
browser it runs in is this repo's: it imports `angular`, `lodash`, `ace` and the
ns_server components through `src/ui/importmap.json` and vendors none of them.
So the tests that drive it live here, and run in the same job.

Two pieces of the product do the heavy lifting, and neither is a stand-in:

- `libs/es-module-shims-options.js` carries the fetch hook that turns
  `import template from "./cw_cbas_catalog_dialog.html"` into a module exporting
  the template text. Every dialog in that UI is loaded that way, so without it
  the controller cannot even be imported.
- `importmap.json` resolves the bare specifiers. The harness serves it verbatim,
  only rebasing its relative targets onto `/ui/`.

Stubbed, and nothing else: `$http`, the ns_server and query-ui services that UI
does not own, and `$uibModal`, which is how a dialog reports OK and the only
thing between a test and a real modal. Everything the assertions touch — the
controller, the query service, the constants, the templates — is what ships.

So each case judges a dialog by its product: either the statement the workbench
would have sent (every DDL path funnels through `executeQueryUtil`, which the
harness replaces), or the markup a user would have been shown (the template the
dialog opened with, compiled against that dialog's own scope).

That second half matters more than it looks. `ng-if="sourceCanVendCredentials()"`
naming a function the scope does not have is simply always false: the option
never appears, nothing is logged, and no other layer can see it.

The cases are in `test/cbas/cases.js` for the workbench and
`test/cbas/rbac_cases.js` for the Security section's Service RBAC page;
`test/cbas/env.js` and `test/cbas/rbac_env.js` are where a new one starts —
each returns the injector's controller, the dialogs it opened and the statements
so far. The boundary both stub is in `test/cbas/stubs.js`.

`test/cbas/users_cases.js` covers one thing in this repo's own source rather
than cbas-ui's: the analytics-roles column on Users & Groups, whose values come
from a query against the analytics service. `users_env.js` builds an injector
over `mn_user_roles_service.js` for it. Note that `test_cbas_mutations.py`
cannot reach these - it mutates the cbas-ui tree, which is the only one the
harness parameterises - so they are the one layer here without a
test-for-the-test.

The RBAC page raises the stakes on the statement half: analytics roles and
privileges have no REST API behind them, so a grant *is* a statement, and the
grammar reads several of them two ways. `GRANT CREATE COLLECTION ...` is one
privilege with an `ON` after it and a different one without; a grantee written
without `USER` is a role. Both alternatives parse, execute and grant the wrong
thing, which is why those cases assert whole statements rather than fragments.

That page's reads are stubbed by which metadata dataset they name, so seeding
`makeRbacEnv({roles, privileges, assignments, users})` is enough to drive it.
It also renders the page, not just the dialogs: `renderPage()` compiles
`cbas_rbac.html` against the controller under its real alias, which is the only
way to see that the action opening a dialog is wired to anything. An `ng-click`
naming a method the alias does not have is silently inert.

### `test_cbas_mutations.py` — tests for those tests

```sh
python3 test/test_cbas_mutations.py
```

The same idea as `test_check_ui.py`, applied to the layer above: each entry
breaks one decision the dialogs make, copies the `cbas-ui` tree with that damage
in place, and asserts a case notices. Two real gaps turned up this way while the
suite was being written — a substring assertion that survived renaming the
column it checked, and a helper that asserted a feature flag was off after
having just written `false` to it.

A mutation whose text is gone is a failure, not a skip. Re-point it rather than
deleting it; a mutation that no longer applies has quietly stopped testing
anything.

## CI

`test/run_ci.sh` is the whole job. It needs `python3` and `docker` — no product
build, no cluster, no JDK, no maven:

```sh
test/run_ci.sh
```

It runs every layer that does not need a cluster, continuing past a failure so
one run reports everything that is broken rather than only the first thing.

The two structural layers run directly under `python3`. The browser layers run
inside the official playwright image, because a bare Jenkins agent has no
chromium shared libraries (`libglib-2.0` and friends) and installing them needs
root — `playwright install --with-deps` cannot help without sudo. Docker is
already required on these agents by testcontainers, so this adds no new
capability. The image carries the browsers and system libraries but not the
python package, so `run_ci.sh` pip-installs it at the matching pinned version
inside the container; no browser is downloaded.

Each layer writes a JUnit report to `target/surefire-reports/`, which is the
pattern the analytics jobs' `JUnitResultArchiver` already collects — so every
check appears as its own case in Jenkins and in the gerrit comment, with the
failure text attached, instead of a single pass/fail blob.

Any of the layers can also be run on its own with `--junit-xml <path>`.

The cluster-based run (`--url`) is not part of this job: it needs an
analytics-profile cluster with an s3mock backing store, so it is driven from
`analytics`, by
`cbas/cbas-server/src/test/java/com/couchbase/analytics/test/ui/UiSmokeIT.java`.
That test brings the cluster up, copies this directory into the playwright image
and runs `test_ui_smoke.py` against it — the same script this job runs against a
stub, so there is one implementation of the browser work rather than two.
