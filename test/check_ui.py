#!/usr/bin/env python3
"""Structural checks for the Enterprise Analytics UI source tree.

Every check here exists because the corresponding breakage actually reached
a build or a review. None of them need a cluster, a browser, a network or an
npm install - just python3 - so this is cheap enough to run on every patchset.

    python3 test/check_ui.py            # from the repo root
    python3 test/check_ui.py --list     # show what each check covers

Exit status is 0 when everything passes, 1 otherwise.
"""

import argparse
import json
import os
import re
import sys
import time

import junit_xml

UI = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'src', 'ui')
UI = os.path.normpath(UI)

# ---------------------------------------------------------------------------
# Things that legitimately do not resolve inside this repo.
# ---------------------------------------------------------------------------

# Written into the build output by ns_server's CMake, and served by the
# pluggable-UI machinery at runtime, so they never exist in this tree.
EXTERNAL_IMPORTS = (
    '../../pluggable-uis.js',
)
EXTERNAL_IMPORT_PREFIXES = (
    '_p/ui/',        # query-ui / cbas-ui, mounted by ns_server
)

# States owned by the pluggable UIs (query-ui, cbas-ui), not by this repo.
EXTERNAL_STATES = (
    'app.admin.cbas',
    'app.admin.query',
    'app.admin.docs',
    'app.admin.settings.query',
)

# Files with no importer in this repo that must NOT be deleted. Each entry
# needs a reason: "unreferenced" and "unused" are not the same thing here.
INTENTIONALLY_UNREACHABLE = {
    # Loaded by query-ui and cbas-ui: they import 'ace/ace' and friends through
    # the importmap, and ace pulls its modes/workers/snippets at runtime from
    # ace.config.set('basePath', '/ui/libs/ace').
    'libs/ace/': 'consumed by query-ui and cbas-ui via importmap + ace basePath',
    'libs/ui-ace.js': 'consumed by query-ui',
    # Only index-dev.html loads these; the shipped index.html does not.
    'libs/es-module-shims.js': 'dev-only entry point (index-dev.html)',
    'libs/es-module-shims-options.js': 'dev-only entry point (index-dev.html)',
    # Pulled in by a hardcoded uib-tooltip-template URL from the Servers page,
    # which no import graph can see.
    'app/components/directives/mn_encryption_status/mn_encryption_status_template.html':
        'loaded at runtime by uib-tooltip-template',
}

SPEC_RE = re.compile(r'''(?:\bfrom\s*|\bimport\s*\(?\s*)['"]([^'"]+)['"]''')
# The regex above also matches the words "from"/"import" inside string literals
# and minified vendor code. A real specifier has no whitespace or punctuation
# beyond path characters, so anything else is a false match, not a broken import.
PLAUSIBLE_SPEC_RE = re.compile(r'^(?=.*[A-Za-z0-9])[A-Za-z0-9@._/-]+$')
CSS_IMPORT_RE = re.compile(r'''@import\s+["']([^"']+)["']''')
# ng-include src="'/ui/x.html'", uib-tooltip-template="'x.html'", templateUrl: "x.html".
# The \\? handles templates embedded in JS string literals, where the quotes
# around the URL arrive escaped.
TEMPLATE_URL_RE = re.compile(
    r'''(?:ng-include[^>]*?src=|uib-tooltip-template=|uib-popover-template=|templateUrl\s*[:=])'''
    r'''\s*\\?["']\\?'?([^"'\\]+\.html)''')
HTML_ASSET_RE = re.compile(r'''(?:href|src)=["']([^"':#]+)["']''')
INJECT_RE = re.compile(r'(\w+)\.\$inject\s*=\s*\[(.*?)\];', re.S)
INLINE_DI_RE = re.compile(r'\[((?:\s*"[^"]+"\s*,)+)\s*function\s*\(([^)]*)\)')
UI_SREF_RE = re.compile(r'''ui-sref=["']([a-zA-Z][a-zA-Z0-9.]*)''')
UI_STATE_RE = re.compile(r'''ui-state=["']\s*'([a-zA-Z][a-zA-Z0-9.]*)''')
STATE_NAME_RE = re.compile(r'''name:\s*['"]([^'"]+)['"]''')


def rel(path):
    return os.path.relpath(path, UI).replace(os.sep, '/')


def walk(*exts, skip_web_modules=True):
    for dirpath, dirnames, filenames in os.walk(UI):
        if skip_web_modules and 'web_modules' in dirpath.split(os.sep):
            continue
        for name in sorted(filenames):
            if name.endswith(exts):
                yield os.path.join(dirpath, name)


def read(path):
    with open(path, encoding='utf-8', errors='ignore') as fh:
        return fh.read()


def strip_html_comments(text):
    return re.sub(r'<!--.*?-->', '', text, flags=re.S)


def strip_js_block_comments(text):
    """Drop /* ... */ blocks before scanning for imports.

    Vendor bundles carry JSDoc with `@example import ... from './childModule.ts'`,
    which is documentation, not a dependency. Erring toward stripping too much
    only risks missing an import in vendor code; it cannot invent a failure.
    """
    return re.sub(r'/\*.*?\*/', '', text, flags=re.S)


def load_importmap():
    return json.loads(read(os.path.join(UI, 'importmap.json')))['imports']


def resolve(spec, from_file, importmap):
    """Resolve an ES module specifier the way the browser's importmap will."""
    if spec.startswith('.'):
        base = os.path.normpath(os.path.join(os.path.dirname(from_file), spec))
        candidates = [base, base + '.js', os.path.join(base, 'index.js')]
    else:
        mapped = importmap.get(spec)
        if mapped is None:
            for key in sorted(importmap, key=len, reverse=True):
                if spec == key or spec.startswith(key.rstrip('/') + '/'):
                    mapped = importmap[key] + spec[len(key):]
                    break
        if mapped is None:
            return None
        if mapped.startswith('/ui/'):
            mapped = mapped[len('/ui/'):]
        candidates = [os.path.join(UI, mapped), os.path.join(UI, mapped) + '.js']
    for candidate in candidates:
        candidate = os.path.normpath(candidate)
        if os.path.isfile(candidate):
            return candidate
    return None


def is_external(spec):
    return spec in EXTERNAL_IMPORTS or any(p in spec for p in EXTERNAL_IMPORT_PREFIXES)


# ---------------------------------------------------------------------------
# Checks. Each returns a list of failure strings.
# ---------------------------------------------------------------------------

def check_importmap_targets():
    """importmap.json is valid JSON and every local target exists."""
    failures = []
    for key, value in load_importmap().items():
        if value.startswith('./') and not os.path.isfile(os.path.join(UI, value)):
            failures.append(f'importmap entry "{key}" -> {value} (missing)')
    return failures


def check_js_imports():
    """Every ES import resolves, including inside web_modules/.

    Scans every file, not only those reachable from main.js: the build's
    minify_js runs over the whole directory, so an unreachable file with a
    broken import still fails the build.

    web_modules/ is included deliberately. Those bundles import each other by
    content-hashed filename, and a snowpack regeneration renames them - if the
    renames are not applied together with the contents, every one of those
    imports dangles. First-party code under app/ is checked in full; for
    minified vendor bundles only relative specifiers are checked, since their
    bare specifiers go through the importmap and are covered by
    check_importmap_targets().
    """
    importmap = load_importmap()
    failures = []
    for path in walk('.js', skip_web_modules=False):
        first_party = rel(path).startswith('app/')
        for spec in SPEC_RE.findall(strip_js_block_comments(read(path))):
            if is_external(spec) or not PLAUSIBLE_SPEC_RE.match(spec):
                continue
            if not first_party and not spec.startswith('.'):
                continue
            if resolve(spec, path, importmap) is None:
                failures.append(f'{rel(path)} -> {spec}')
    return failures


def check_css_imports():
    """Every CSS @import resolves (index.css pulls in libs/ and app/css/)."""
    failures = []
    for path in walk('.css'):
        for spec in CSS_IMPORT_RE.findall(read(path)):
            target = os.path.normpath(os.path.join(os.path.dirname(path), spec))
            if not os.path.exists(target):
                failures.append(f'{rel(path)} -> {spec}')
    return failures


def check_runtime_templates():
    """Templates fetched by URL at runtime exist.

    ng-include / uib-tooltip-template / uib-popover-template / templateUrl are
    plain strings resolved by $http at runtime, so nothing at build time
    notices when the target is deleted.
    """
    failures = []
    for path in walk('.html', '.js'):
        for spec in TEMPLATE_URL_RE.findall(read(path)):
            candidates = [
                os.path.join(UI, spec[len('/ui/'):]) if spec.startswith('/ui/') else None,
                os.path.join(UI, spec),
                os.path.normpath(os.path.join(os.path.dirname(path), spec)),
            ]
            if not any(c and os.path.isfile(c) for c in candidates):
                failures.append(f'{rel(path)} -> {spec}')
    return failures


def check_html_assets():
    """Stylesheets and scripts referenced by the entry points exist."""
    failures = []
    for name in ('index.html', 'index-dev.html'):
        path = os.path.join(UI, name)
        for spec in HTML_ASSET_RE.findall(read(path)):
            if spec.startswith(('/', '..', 'http')):
                continue
            if not os.path.exists(os.path.join(UI, spec)):
                failures.append(f'{name} -> {spec}')
    return failures


def check_di_annotations():
    """AngularJS DI annotations match their function signatures.

    These are positional. Dropping a service from the annotation array but not
    the signature (or vice versa) silently injects the wrong service into every
    parameter after it rather than failing loudly.

    Only app/ is checked: vendored libs ship minified, where the parameter
    names are mangled and never match the annotation strings.
    """
    failures = []
    for path in walk('.js'):
        if not rel(path).startswith('app/'):
            continue
        text = read(path)
        for match in INJECT_RE.finditer(text):
            name, array = match.group(1), match.group(2)
            sig = re.search(r'function\s+' + re.escape(name) + r'\s*\(([^)]*)\)', text)
            if not sig:
                continue
            annotated = [x.strip().strip('"\'') for x in array.split(',') if x.strip()]
            params = [x.strip() for x in sig.group(1).split(',') if x.strip()]
            if annotated != params:
                failures.append(f'{rel(path)} :: {name}\n      $inject: {annotated}\n      params:  {params}')
        for match in INLINE_DI_RE.finditer(text):
            annotated = [x.strip().strip('"') for x in match.group(1).rstrip(',').split(',') if x.strip()]
            params = [x.strip() for x in match.group(2).split(',') if x.strip()]
            if annotated != params:
                failures.append(f'{rel(path)} (inline)\n      $inject: {annotated}\n      params:  {params}')
    return failures


def registered_states():
    """Return (exact, wildcard) state names.

    The distinction matters. A lazy-loaded entry declared as 'app.admin.foo.**'
    stands in for every descendant, so links to its children are fine. A plain
    .state('app.admin') covers only itself - treating it as a prefix would make
    every app.admin.* link look registered, including links to deleted pages.
    """
    text = read(os.path.join(UI, 'app', 'mn.app.imports.js'))
    exact, wildcard = set(), set()
    for name in STATE_NAME_RE.findall(text):
        (wildcard if name.endswith('.**') else exact).add(name.replace('.**', ''))
    for path in walk('.js'):
        for match in re.finditer(r'''\.state\(\s*['"]([^'"]+)['"]''', read(path)):
            name = match.group(1)
            (wildcard if name.endswith('.**') else exact).add(name.replace('.**', ''))
    return exact, wildcard


def check_router_links():
    """Every ui-sref/ui-state in live markup points at a registered state.

    HTML comments are stripped first: this fork disables pages by commenting
    the nav entry out, so commented links are expected to dangle.
    """
    exact, wildcard = registered_states()
    failures = []
    for path in walk('.html'):
        live = strip_html_comments(read(path))
        for target in set(UI_SREF_RE.findall(live)) | set(UI_STATE_RE.findall(live)):
            if not target.startswith('app.'):
                continue
            if target in exact:
                continue
            if any(target == s or target.startswith(s + '.')
                   for s in wildcard | set(EXTERNAL_STATES)):
                continue
            failures.append(f'{rel(path)} -> {target}')
    return failures


def check_html_comments_balanced():
    """Unbalanced <!-- --> silently swallows live markup.

    Deleting a disabled nav entry is easy to get wrong when the closing --> sits
    on a line that is being removed.
    """
    failures = []
    for path in walk('.html'):
        text = read(path)
        if text.count('<!--') != text.count('-->'):
            failures.append(f'{rel(path)}: {text.count("<!--")} "<!--" vs {text.count("-->")} "-->"')
    return failures


def check_no_unexpected_orphans():
    """Nothing is unreachable from main.js unless it is a known runtime entry point.

    Catches dead code left behind by a page removal, and - in the other
    direction - stops a file being deleted on 'nothing imports it' grounds when
    something loads it by URL instead.
    """
    importmap = load_importmap()
    roots = [os.path.join(UI, 'app', 'main.js'),
             os.path.join(UI, 'libs', 'reflect-metadata.js'),
             os.path.join(UI, 'libs', 'zone.js')]
    seen, stack = set(), [r for r in roots if os.path.isfile(r)]
    while stack:
        current = stack.pop()
        if current in seen:
            continue
        seen.add(current)
        if not current.endswith('.js'):
            continue
        for spec in SPEC_RE.findall(read(current)):
            target = resolve(spec, current, importmap)
            if target and target not in seen:
                stack.append(target)
    failures = []
    for path in walk('.js', '.html'):
        name = rel(path)
        if not (name.startswith('app/') or name.startswith('libs/')):
            continue
        if path in seen:
            continue
        if any(name == k or name.startswith(k) for k in INTENTIONALLY_UNREACHABLE):
            continue
        failures.append(name)
    return failures


CHECKS = [
    ('importmap targets exist', check_importmap_targets),
    ('js imports resolve', check_js_imports),
    ('css imports resolve', check_css_imports),
    ('runtime template urls resolve', check_runtime_templates),
    ('entry-point assets exist', check_html_assets),
    ('angularjs DI annotations match signatures', check_di_annotations),
    ('router links point at registered states', check_router_links),
    ('html comments balanced', check_html_comments_balanced),
    ('no unexpected orphans', check_no_unexpected_orphans),
]


def main():
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--list', action='store_true', help='describe each check and exit')
    parser.add_argument('--ui-dir', help='UI source tree to check (default: ../src/ui)')
    parser.add_argument('--only', help='run just this check, by name')
    parser.add_argument('--junit-xml', help='write a JUnit report here')
    args = parser.parse_args()

    if args.ui_dir:
        global UI
        UI = os.path.abspath(args.ui_dir)

    if args.list:
        for name, fn in CHECKS:
            print(f'{name}\n    {(fn.__doc__ or "").strip().splitlines()[0]}')
        return 0

    if not os.path.isdir(UI):
        print(f'FATAL: cannot find the UI source tree at {UI}', file=sys.stderr)
        return 1

    failed = 0
    cases = []
    for name, fn in CHECKS:
        if args.only and args.only != name:
            continue
        started = time.time()
        failures = fn()
        cases.append((name, '\n'.join(failures) if failures else None,
                      time.time() - started))
        if failures:
            failed += 1
            print(f'FAIL  {name}  ({len(failures)})')
            for item in failures:
                print(f'      {item}')
        else:
            print(f'ok    {name}')

    if args.junit_xml:
        junit_xml.write(args.junit_xml, 'ui.check_ui', cases)

    print()
    if failed:
        print(f'{failed} of {len(cases)} checks failed')
        return 1
    print(f'all {len(cases)} checks passed')
    return 0


if __name__ == '__main__':
    sys.exit(main())
