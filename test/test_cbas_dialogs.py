#!/usr/bin/env python3
"""Behaviour tests for the cbas-ui dialogs.

The workbench is a pluggable UI in the sibling cbas-ui project, but it is this
repo that supplies the browser it runs in: angular, lodash, ace, the ns_server
components and the importmap that wires them together all live in src/ui, and
cbas-ui vendors none of them. So the tests that drive it live here too, beside
the rest of the UI suite, and run in the same job.

    python3 test/test_cbas_dialogs.py

The code under test is the shipped cbas-ui source, loaded through the product's
own importmap and module loader and instantiated against a real AngularJS
injector. Only the boundary is stubbed - $http, the ns_server and query-ui
services that UI does not own, and $uibModal, which is how a dialog reports OK.
So a case judges a dialog by its product: either the statement the workbench
would have sent, or the markup a user would have been shown.

The cases themselves are in test/cbas/cases.js; this file only serves the
sources, drives the browser and reports what came back. Needs playwright;
run_ci.sh supplies it, and a browser, by running this in the playwright image.
"""

import argparse
import contextlib
import http.server
import json
import os
import socketserver
import sys
import threading
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import junit_xml

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
UI = os.path.join(REPO, 'src', 'ui')
HARNESS = os.path.join(HERE, 'cbas')
# The pluggable UI's doc-root, as CMake installs it. In a repo workspace the
# checkout sits beside this one; run_ci.sh stages it next to src/ui.
DEFAULT_CBAS_UI = os.path.join(os.path.dirname(REPO), 'cbas-ui', 'cbas-ui')

# Where the pluggable UI is mounted. The directory has to be named "cbas": those
# modules import each other as "../cbas/cw_constants_service.js", which resolves
# back to the same directory only under that name.
CBAS_MOUNT = '/_p/ui/cbas/'


class _Handler(http.server.SimpleHTTPRequestHandler):
    """Serves src/ui and the pluggable UI, plus the importmap rebased onto them."""

    cbas_ui = None

    def translate_path(self, path):
        path = path.split('?', 1)[0].split('#', 1)[0]
        for prefix, root in (('/ui/', UI),
                             (CBAS_MOUNT, self.cbas_ui),
                             ('/harness/', HARNESS)):
            if path.startswith(prefix):
                return os.path.join(root, path[len(prefix):].lstrip('/'))
        return os.path.join(HARNESS, path.lstrip('/'))

    def do_GET(self):
        if self.path.split('?', 1)[0] == '/harness/importmap.json':
            return self._importmap()
        return super().do_GET()

    def _importmap(self):
        """src/ui/importmap.json, with its targets rebased onto /ui/.

        Its entries are relative ("./web_modules/angular.js") and resolve
        against the importmap's own URL, so serving it from /harness/ unchanged
        would point every library at a directory that does not exist.
        """
        with open(os.path.join(UI, 'importmap.json'), encoding='utf-8') as fh:
            imports = json.load(fh)['imports']
        rebased = {key: '/ui/' + value[2:] if value.startswith('./') else value
                   for key, value in imports.items()}
        body = json.dumps({'imports': rebased}).encode()
        self.send_response(200)
        self.send_header('Content-Type', 'application/importmap+json')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *args):
        pass


class _Server(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True


@contextlib.contextmanager
def serve(cbas_ui):
    _Handler.cbas_ui = cbas_ui
    server = _Server(('127.0.0.1', 0), _Handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    try:
        yield f'http://127.0.0.1:{server.server_address[1]}/harness/index.html'
    finally:
        server.shutdown()


@contextlib.contextmanager
def browser():
    """One chromium for the whole run - launching it dominates the runtime."""
    from playwright.sync_api import sync_playwright
    with sync_playwright() as playwright:
        instance = playwright.chromium.launch()
        try:
            yield instance
        finally:
            instance.close()


def run(browser_instance, cbas_ui, timeout_ms=60000):
    """Run every case against `cbas_ui`, as (name, failure_or_None, seconds)."""
    noise = []
    page = browser_instance.new_page()
    page.on('console', lambda msg: msg.type == 'error' and noise.append(msg.text))
    page.on('pageerror', lambda error: noise.append(str(error)))
    try:
        with serve(cbas_ui) as url:
            page.goto(url)
            try:
                page.wait_for_function('window.__cbasTestResults', timeout=timeout_ms)
            except Exception:
                # Nothing ran at all - a module failed to load, or the harness
                # threw before the first case. The console is the only evidence
                # of that, so it has to reach the report rather than the run
                # being counted as "0 cases, all passed".
                detail = '\n'.join(noise) or 'no console output'
                return [('harness loads', f'the harness produced no results:\n{detail}', 0.0)]
            results = page.evaluate('window.__cbasTestResults')
    finally:
        page.close()
    return [(case['name'], case['failure'], case['seconds']) for case in results]


def report(cases):
    failed = 0
    for name, failure, _ in cases:
        if failure:
            failed += 1
            print(f'FAIL  {name}')
            for line in failure.splitlines():
                print(f'      {line}')
        else:
            print(f'ok    {name}')
    return failed


def add_arguments(parser):
    parser.add_argument('--cbas-ui', default=DEFAULT_CBAS_UI,
                        help='cbas-ui doc-root to test (default: ../../cbas-ui/cbas-ui)')
    parser.add_argument('--junit-xml', help='write a JUnit report here')
    return parser


def check_cbas_ui(cbas_ui):
    if os.path.isfile(os.path.join(cbas_ui, 'cw_cbas_controller.js')):
        return True
    print(f'FATAL: no cbas-ui doc-root at {cbas_ui}\n'
          f'       pass --cbas-ui, or sync the cbas-ui project beside this one',
          file=sys.stderr)
    return False


def main():
    parser = add_arguments(argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter))
    parser.add_argument('--timeout', type=int, default=60000,
                        help='milliseconds to wait for the cases to finish')
    args = parser.parse_args()

    if not check_cbas_ui(args.cbas_ui):
        return 1

    started = time.time()
    with browser() as instance:
        cases = run(instance, args.cbas_ui, args.timeout)
    failed = report(cases)

    if args.junit_xml:
        junit_xml.write(args.junit_xml, 'ui.cbas_dialogs', cases)

    print()
    if failed:
        print(f'{failed} of {len(cases)} cases failed  ({time.time() - started:.1f}s)')
        return 1
    print(f'all {len(cases)} cases passed  ({time.time() - started:.1f}s)')
    return 0


if __name__ == '__main__':
    sys.exit(main())
