# UI tests

Tests for the Enterprise Analytics UI fork. They live here, outside `src/ui`,
because CMake symlinks the whole of `src/ui` into the build output — anything
placed under it ships to customers.

## Layers

| | What it needs | What it catches |
|---|---|---|
| `check_ui.py` | python3 | Structural breakage: dangling imports, missing assets, DI mismatches, links to removed pages |
| `test_check_ui.py` | python3 | That `check_ui.py` still fails when it should |

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

## CI

`test/run_ci.sh` is the whole job. It needs `python3` and nothing else — no
product build, no cluster, no JDK, no maven, no third-party packages:

```sh
test/run_ci.sh
```

It runs both layers, continuing past a failure so one run reports everything
that is broken rather than only the first thing. It takes about a second.

Each layer writes a JUnit report to `target/surefire-reports/`, which is the
pattern the analytics jobs' `JUnitResultArchiver` already collects — so every
check appears as its own case in Jenkins and in the gerrit comment, with the
failure text attached, instead of a single pass/fail blob.

Any of the layers can also be run on its own with `--junit-xml <path>`.
