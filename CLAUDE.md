# columnar-ui-v1

Cluster management UI for Enterprise Analytics (EA). Handles cluster configuration, security (users, roles, LDAP, certificates, audit), metrics dashboards, and server topology management.

This is a **fork of Couchbase ns_server's Angular UI**, rebranded and scoped down to be EA-specific. It originated when EA was an integrated service within Couchbase Server; the fork retains the cluster operations layer but removes data-plane features (document browser, N1QL workbench, map-reduce views). The package name `ns_server-ui` is a leftover from the fork origin.

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

## What's EA-Specific vs ns_server Origin

**Retained from ns_server**: cluster topology, server management, auto-failover, RBAC/LDAP/certificates, audit logging, metrics dashboards, blob storage config (S3/Azure/GCS), GSI index management.

**Removed/not present**: document browser, N1QL/query workbench, map-reduce views, application data tooling.

## Tests

No unit or integration tests in this project. E2E tests live in the main `testrunner/` project.

## Related Projects

| Path (relative to this dir) | Description |
|-----------------------------|-------------|
| `../analytics` | CBAS Java backend |
| `../cbas-ui` | Analytics query engine UI (workbench, links, DDL/DML) |
