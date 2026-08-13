#!/usr/bin/env python3
"""Tests for check_ui.py.

A check that never fails is worse than no check, because it reads as coverage.
Each case below reintroduces a defect that actually happened - most of them
during the Enterprise Analytics UI prune - and asserts that the matching check
catches it.

    python3 test/test_check_ui.py

Exit status is 0 when every case behaves as expected, 1 otherwise.
"""

import os
import re
import shutil
import subprocess
import sys
import tempfile
import time

import junit_xml

HERE = os.path.dirname(os.path.abspath(__file__))
CHECKER = os.path.join(HERE, 'check_ui.py')
REAL_UI = os.path.normpath(os.path.join(HERE, '..', 'src', 'ui'))


def run_check(ui_dir, only=None):
    cmd = [sys.executable, CHECKER, '--ui-dir', ui_dir]
    if only:
        cmd += ['--only', only]
    proc = subprocess.run(cmd, capture_output=True, text=True)
    return proc.returncode, proc.stdout + proc.stderr


def edit(path, fn):
    with open(path, encoding='utf-8') as fh:
        text = fh.read()
    new = fn(text)
    assert new != text, f'mutation had no effect on {path}'
    with open(path, 'w', encoding='utf-8') as fh:
        fh.write(new)


# --- mutations: each returns the name of the check expected to catch it -------

def break_css_import(ui):
    """The build failure: libs/codemirror.css removed, index.css still imports it."""
    os.remove(os.path.join(ui, 'libs', 'selectize.default.css'))
    return 'css imports resolve'


def break_web_module_rename(ui):
    """The lodash bug: a hashed bundle renamed without updating its importers."""
    common = os.path.join(ui, 'web_modules', 'common')
    victim = sorted(f for f in os.listdir(common) if f.endswith('.js'))[0]
    os.rename(os.path.join(common, victim), os.path.join(common, 'renamed-' + victim))
    return 'js imports resolve'


def break_runtime_template(ui):
    """The tooltip bug: a template only referenced by a hardcoded URL, deleted."""
    os.remove(os.path.join(ui, 'app', 'components', 'directives',
                           'mn_encryption_status', 'mn_encryption_status_template.html'))
    return 'runtime template urls resolve'


def break_di_annotation(ui):
    """A service dropped from a $inject array but left in the signature."""
    target = os.path.join(ui, 'app', 'mn_admin', 'mn_servers_list_item_controller.js')
    edit(target, lambda t: t.replace('"mnServersService", ', '', 1))
    return 'angularjs DI annotations match signatures'


def break_router_link(ui):
    """A live nav link left pointing at a page that was removed."""
    target = os.path.join(ui, 'app', 'mn_admin', 'mn_admin.html')
    edit(target, lambda t: t.replace('ui-sref="app.admin.servers.list"',
                                     'ui-sref="app.admin.views.list"', 1))
    return 'router links point at registered states'


def break_html_comment(ui):
    """The sed accident: a comment terminator removed, swallowing live markup."""
    target = os.path.join(ui, 'app', 'mn_admin', 'mn_admin.html')
    edit(target, lambda t: t[::-1].replace('-->'[::-1], '', 1)[::-1])
    return 'html comments balanced'


def break_missing_import_target(ui):
    """A file deleted while first-party code still imports it."""
    os.remove(os.path.join(ui, 'app', 'mn.alerts.service.js'))
    return 'js imports resolve'


def break_orphan(ui):
    """Dead code left behind by a page removal."""
    with open(os.path.join(ui, 'app', 'mn.leftover.component.js'), 'w') as fh:
        fh.write('export class MnLeftover {}\n')
    return 'no unexpected orphans'


def break_importmap_target(ui):
    """An importmap entry pointing at a file that no longer exists."""
    edit(os.path.join(ui, 'importmap.json'),
         lambda t: t.replace('"angular":', '"gone": "./app/gone.js",\n    "angular":', 1))
    return 'importmap targets exist'


def break_entry_asset(ui):
    """A stylesheet referenced by index-dev.html but removed."""
    os.remove(os.path.join(ui, 'libs', 'angular-ui-select.css'))
    return 'entry-point assets exist'


MUTATIONS = [
    break_css_import,
    break_web_module_rename,
    break_runtime_template,
    break_di_annotation,
    break_router_link,
    break_html_comment,
    break_missing_import_target,
    break_orphan,
    break_importmap_target,
    break_entry_asset,
]


def main(junit_path=None):
    if not os.path.isdir(REAL_UI):
        print(f'FATAL: no UI tree at {REAL_UI}', file=sys.stderr)
        return 1

    print('baseline: the real tree must pass')
    code, out = run_check(REAL_UI)
    if code != 0:
        print('FAIL  the unmodified tree does not pass check_ui.py')
        print(out)
        return 1
    print('ok    unmodified tree passes\n')

    failures = 0
    cases = []
    with tempfile.TemporaryDirectory() as tmp:
        pristine = os.path.join(tmp, 'pristine')
        shutil.copytree(REAL_UI, pristine, symlinks=True)

        for mutate in MUTATIONS:
            work = os.path.join(tmp, 'work')
            shutil.rmtree(work, ignore_errors=True)
            shutil.copytree(pristine, work, symlinks=True)

            summary = (mutate.__doc__ or mutate.__name__).strip().splitlines()[0]
            started = time.time()
            try:
                expected = mutate(work)
            except Exception as exc:
                # A mutation that no longer applies is itself a failure: the
                # case has drifted from the tree and is silently testing nothing.
                failures += 1
                cases.append((mutate.__name__, f'could not apply mutation: {exc}',
                              time.time() - started))
                print(f'FAIL  could not apply mutation ({summary}): {exc}')
                continue
            code, out = run_check(work, only=expected)

            elapsed = time.time() - started
            if code == 0:
                failures += 1
                cases.append((mutate.__name__,
                              f'"{expected}" did not fail for: {summary}', elapsed))
                print(f'FAIL  "{expected}" did not catch: {summary}')
            else:
                cases.append((mutate.__name__, None, elapsed))
                print(f'ok    "{expected}" caught: {summary}')

    if junit_path:
        junit_xml.write(junit_path, 'ui.test_check_ui', cases)

    print()
    if failures:
        print(f'{failures} of {len(MUTATIONS)} mutations went undetected')
        return 1
    print(f'all {len(MUTATIONS)} mutations detected')
    return 0


if __name__ == '__main__':
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument('--junit-xml', help='write a JUnit report here')
    sys.exit(main(ap.parse_args().junit_xml))
