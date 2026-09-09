# columnar-ui-v1

Cluster management UI for Couchbase Operational Insights (OI), the product formerly called Enterprise Analytics. Handles cluster configuration, security (users, roles, LDAP, certificates, audit), metrics dashboards, and server topology management.

This is a **fork of Couchbase ns_server's Angular UI**, rebranded and scoped down to be product-specific. It originated when analytics was an integrated service within Couchbase Server; the fork retains the cluster operations layer but removes data-plane features (document browser, N1QL workbench, map-reduce views). The package name `ns_server-ui` is a leftover from the fork origin.

**The repository name is not renamed and should not be.** `columnar-ui-v1` dates from the Columnar era, two product names ago, and survived the rename to Enterprise Analytics untouched. The same holds across the tree: `cbas-core`, `cbas-ui` and `cbas` are named for the Couchbase Analytics Service, the manifest still declares `COLUMNAR_COMPAT_VERSION`, and `prod` stays `"analytics"`. These are frozen identifiers -- renaming them buys nothing and breaks every existing reference. Only display names follow a rebrand.

## Build

Working directory for all commands: `src/ui/`

```bash
npm run rebuild     # Clean build — removes node_modules & web_modules, npm install, snowpack, cleanup
npm run checks      # ESLint validation
```

**Node.js**: `^14.13.1 || >=16.0.0`

The build produces pre-compiled ES modules in `src/ui/web_modules/` and an import map at `src/ui/importmap.json`. Final JS/CSS output referenced as `../ea-jsout/main.js` and `../ea-cssout/index.css` — compiled by the broader Couchbase build.

## Tech Stack

- **Angular 8.2** + **AngularJS 1.8** hybrid via `@angular/upgrade` (UpgradeModule) — gradual migration from AngularJS to Angular, same pattern as the ns_server UI it was forked from
- **UI Router** (`@uirouter/angularjs` + `@uirouter/angular-hybrid`) for state-based routing with lazy loading
- **Snowpack** (v1.7.1) for ES module bundling (`web_modules/`)
- **D3** (v4 + v5 modules) for metrics charts
- **ng-bootstrap 5.3** + **angular-ui-bootstrap 1.2** for dialogs and UI components
- **RxJS 6.5** for reactive streams throughout Angular services
- **CodeMirror 5.56**, **Selectize.js**, **Sortable.js**, **lodash**, **ramda**

## Linting

ESLint with security-focused rules (`no-eval`, `no-script-url`, `no-implied-eval`). Style/format rules are largely disabled — the ruleset prioritises correctness over style.

```bash
npm run checks      # Run from src/ui/
```

No Prettier config. No TypeScript — pure ES6 modules with JSDoc annotations for Angular decorators.

**Browser targets**: Chrome ≥ 67, Firefox ≥ 67, Safari ≥ 11.1, Edge ≥ 80.

## Key Modules

All source lives under `src/ui/app/`:

| Module / File | Purpose |
|---------------|---------|
| `mn_admin/` (~141 files) | Main admin dashboard — servers, settings, security, statistics, indexes, groups |
| `mn_wizard/` | Cluster initialisation wizard |
| `mn_auth/` | Authentication / login |
| `components/` | Shared directives (search, select, memory quota, bar usage, etc.) and services |
| `mn.app.module.js` | Root Angular NgModule |
| `app.js` | Root AngularJS/Angular hybrid module |
| `app_config.js` | Global routing and configuration |

**Core Angular services** (in `components/` and `mn_admin/`):
- `MnPoolsService` — cluster pool data caching
- `MnStatsService` — metrics data fetching
- `MnPermissionsService` — RBAC permission checking
- `MnSecurityService` — users, roles, certificates
- `MnServerGroupsService` — server group topology
- `MnSettingsClusterService` — auto-failover, compaction, query settings
- `MnTasksService` — background task tracking

## What's OI-Specific vs ns_server Origin

**Retained from ns_server**: cluster topology, server management, auto-failover, RBAC/LDAP/certificates, audit logging, metrics dashboards, blob storage config (S3/Azure/GCS), GSI index management.

**Removed/not present**: document browser, N1QL/query workbench, map-reduce views, application data tooling.

## Tests

`test/` holds the UI suite. It sits outside `src/ui` on purpose: CMake symlinks the whole of that directory into the build output, so anything placed under it ships to customers. Run from the repo root, not from `src/ui`.

| Layer | Needs | Catches |
|---|---|---|
| `check_ui.py` | python3 | Structural breakage: dangling imports, missing assets, DI mismatches, links to removed pages |
| `test_check_ui.py` | python3 | That `check_ui.py` still fails when it should |
| `test_ui_smoke.py --serve-source` | docker | The app failing to boot, or asking at runtime for a module or template that no longer exists |
| `test_cbas_dialogs.py` | docker + `../cbas-ui` | The analytics workbench's dialogs building the wrong statement, or showing the wrong fields |
| `test_cbas_mutations.py` | docker + `../cbas-ui` | A case in `test_cbas_dialogs.py` that can no longer fail |
| `test_ui_smoke.py --url ...` | playwright + a cluster | Nav contents, every live route loading clean, removed pages not rendering, the workbench running a query |

`test/README.md` documents each of these; `test/run_ci.sh` runs everything that does not need a cluster.

**Two jobs run this suite, and both are driven from this repo.** `run_ci.sh` is the whole of [cbas-ui-test](https://analytics.jenkins.couchbase.com/job/cbas-ui-test/), which triggers on changes to *either* this project or `cbas-ui`. The cluster mode needs an analytics-profile cluster with an s3mock backing store, so it runs from `analytics`, in `cbas/cbas-server/src/test/java/com/couchbase/analytics/test/ui/UiSmokeIT.java` ([cbas-other-tests](https://analytics.jenkins.couchbase.com/job/cbas-other-tests/)): that test brings up the cluster, copies this `test/` directory into the playwright image and runs the same script against it. The browser work lives here so that both jobs share one implementation.

So a UI test belongs in this directory even when what it exercises is `cbas-ui`: that project vendors no angular, lodash or ace, and the importmap that resolves them is this repo's.

E2E tests of the broader product live in the main `testrunner/` project.

## Related Projects

| Path (relative to this dir) | Description |
|-----------------------------|-------------|
| `../analytics` | CBAS Java backend |
| `../cbas-ui` | Analytics query engine UI (workbench, links, DDL/DML) |
