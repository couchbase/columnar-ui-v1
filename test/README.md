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

**Against a cluster** — the full suite:

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

## CI

`test/run_ci.sh` is the whole job. It needs `python3` and `docker` — no product
build, no cluster, no JDK, no maven:

```sh
test/run_ci.sh
```

It runs all three layers, continuing past a failure so one run reports
everything that is broken rather than only the first thing.

The two structural layers run directly under `python3`. The browser layer runs
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
analytics-profile cluster with an s3mock backing store, so it belongs in a job
that already provisions one, after its deploy step.
