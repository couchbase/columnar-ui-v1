#!/usr/bin/env python3
"""Browser smoke tests for the Enterprise Analytics UI.

Two modes, same assertions where they overlap:

  # against a running cluster - the full suite. index-dev.html is served from
  # the symlinked source tree, so this tests working-tree edits with no rebuild.
  python3 test/test_ui_smoke.py --url http://127.0.0.1:8091 \
      --user Administrator --password <password>

  # hermetic: serves src/ui with a stub REST API, no cluster needed
  python3 test/test_ui_smoke.py --serve-source

The hermetic mode cannot log in, so it covers boot, asset loading and the
login page only. That is still the class of failure that hurts most: a
dangling module import or a template fetched by URL that no longer exists
shows up as a console error or a 404 here, and in neither case does the
product build complain.

Requires playwright:

    pip install playwright && playwright install chromium

Exit status is 0 when every case passes, 1 otherwise.
"""

import argparse
import http.server
import json
import os
import socketserver
import sys
import threading
import time

import junit_xml

UI = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)),
                                   '..', 'src', 'ui'))
PUBLIC = os.path.dirname(UI)

# Nav entries the fork is expected to show. Anything appearing here that was
# meant to be removed - or missing that should be live - is a regression.
EXPECTED_NAV = ['Dashboard', 'Servers', 'Security', 'Settings', 'Logs', 'Workbench']

# Pages removed from this fork. Their states are gone, so uiRouter's otherwise()
# handler should bounce these to the dashboard rather than render anything.
REMOVED_ROUTES = ['/replications', '/views', '/buckets', '/collections',
                  '/index', '/settings/sampleBuckets', '/settings/autoCompaction']

LIVE_ROUTES = ['/overview', '/servers', '/logs', '/settings', '/security']

# 401s are how the UI discovers it is not logged in yet; they are not failures.
IGNORED_STATUSES = (401,)


# ---------------------------------------------------------------------------
# Hermetic mode: serve src/ui with just enough REST to let the app boot.
# ---------------------------------------------------------------------------

class _StubHandler(http.server.SimpleHTTPRequestHandler):
    STUBS = {
        '/_uiEnv': {'disable_autocomplete': True},
        # mnPools derives isInitialized from pools.pools.length, so this list
        # must be non-empty or the app routes to the setup wizard instead of
        # the login page.
        # prodName drives poolDefault.isColumnar; this UI is only compatible
        # with an analytics-profile cluster, so the stub must claim to be one.
        '/pools': {'isEnterprise': True, 'uuid': 'stub',
                   'prodName': 'Enterprise Analytics',
                   'implementationVersion': '0.0.0-0000-enterprise-analytics',
                   'componentsVersion': {},
                   'pools': [{'name': 'default', 'uri': '/pools/default'}]},
    }

    def translate_path(self, path):
        path = path.split('?', 1)[0].split('#', 1)[0]
        if path.startswith('/ui/'):
            return os.path.join(UI, path[len('/ui/'):].lstrip('/'))
        return os.path.join(PUBLIC, path.lstrip('/'))

    def do_GET(self):
        clean = self.path.split('?', 1)[0]
        if clean in self.STUBS:
            return self._json(200, self.STUBS[clean])
        # ns_server generates this at build time from the shipped pluggable UIs;
        # it never exists in this repo. An empty module is a faithful stand-in
        # for "no pluggable UIs installed".
        if clean == '/pluggable-uis.js':
            body = b'export {};\n'
            self.send_response(200)
            self.send_header('Content-Type', 'application/javascript')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        if os.path.isfile(self.translate_path(clean)):
            return super().do_GET()
        if clean.startswith('/ui/'):
            # A missing asset is a missing asset - answering 401 here would
            # disguise the exact failure this mode exists to catch.
            self.send_response(404)
            self.send_header('Content-Length', '0')
            self.end_headers()
            return
        # One rule instead of an endpoint-by-endpoint mock: anything that is not
        # a real asset is an API call, and this cluster has nobody signed in.
        # Chasing individual endpoints here would mean reimplementing ns_server.
        return self._unauthenticated()

    def do_POST(self):
        return self._unauthenticated()

    def _unauthenticated(self):
        self.send_response(401)
        self.send_header('Content-Length', '0')
        self.end_headers()

    def _json(self, code, payload):
        body = json.dumps(payload).encode()
        self.send_response(code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *args):
        pass


class _Server(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True


def serve_source():
    server = _Server(('127.0.0.1', 0), _StubHandler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    return server, f'http://127.0.0.1:{server.server_address[1]}'


# ---------------------------------------------------------------------------

class Recorder:
    """Collects console errors and failed responses for the current step."""

    def __init__(self, page):
        self.console = []
        self.responses = []
        page.on('console', self._console)
        page.on('response', self._response)

    # The browser logs a console error for every failed request, and Angular
    # logs a bare "HttpErrorResponse" alongside it. Both duplicate the response
    # events, which are judged by status - keeping them would report an ignored
    # 401 as a failure.
    NOISE = ('Failed to load resource', 'HttpErrorResponse')

    def _console(self, msg):
        if msg.type == 'error' and not msg.text.startswith(self.NOISE):
            self.console.append(msg.text)

    def _response(self, response):
        if response.status >= 400 and response.status not in IGNORED_STATUSES:
            self.responses.append(f'{response.status} {response.url}')

    def reset(self):
        self.console.clear()
        self.responses.clear()

    def problems(self):
        return ([f'console: {c}' for c in self.console] +
                [f'response: {r}' for r in self.responses])


def hash_route(page, base, route, entry):
    page.goto(f'{base}/ui/{entry}#!{route}', wait_until='domcontentloaded')
    page.wait_for_timeout(1500)


def current_route(page):
    url = page.url
    return url.split('#!', 1)[1] if '#!' in url else ''


def run(page, base, user, password, hermetic, entry):
    rec = Recorder(page)
    results = []
    last = [time.time()]

    def check(name, problems):
        now = time.time()
        results.append((name, problems, now - last[0]))
        last[0] = now
        print(('ok    ' if not problems else 'FAIL  ') + name)
        for problem in problems[:10]:
            print(f'      {problem}')

    # --- boot -------------------------------------------------------------
    page.goto(f'{base}/ui/{entry}', wait_until='networkidle', timeout=60000)
    page.wait_for_timeout(3000)
    booted = page.evaluate("!!document.querySelector('.root-container, [ui-view]')")
    check('app bootstraps', [] if booted else ['no ui-view/root-container in the DOM'])
    if hermetic:
        # Only asset failures are meaningful against the stub: every API call is
        # answered 401 by design, and the app's reaction to that is not being
        # modelled here.
        check('every module and template the app requests exists',
              [p for p in rec.problems() if '/ui/' in p])
    else:
        check('no errors or missing assets during boot', rec.problems())

    if hermetic:
        # Deliberately stops here. Reproducing ns_server's auth semantics
        # faithfully enough to reach a signed-in UI would mean reimplementing
        # it, and a stub that is subtly wrong gives false confidence. What a
        # static file server can prove honestly is that every module and
        # template the app asks for exists - which is exactly the breakage that
        # the product build does not catch.
        return results

    # --- cluster profile --------------------------------------------------
    # This UI is only compatible with an analytics-profile cluster. Against a
    # default_profile cluster nearly everything below fails in confusing ways,
    # so say so plainly instead.
    prod = page.evaluate(
        """async () => {
             const r = await fetch('/pools');
             if (!r.ok) return null;
             return (await r.json()).prodName || '';
           }""")
    if prod is not None and prod != 'Enterprise Analytics':
        check('cluster runs the analytics profile',
              [f'prodName is {prod!r}, expected "Enterprise Analytics" - '
               f'start the cluster with the analytics profile'])
        return results

    # --- login ------------------------------------------------------------
    rec.reset()
    if page.locator('#auth-password-input').count() > 0:
        page.fill('#auth-username-input', user)
        page.fill('#auth-password-input', password)
        page.click('button[type="submit"]')
        page.wait_for_timeout(4000)
    signed_in = page.locator('nav.nav-sidebar').count() > 0
    check('sign in reaches the admin UI', [] if signed_in else ['no nav sidebar after login'])
    if not signed_in:
        return results
    check('no errors during login', rec.problems())

    # --- nav --------------------------------------------------------------
    rec.reset()
    labels = [t.strip() for t in page.locator('nav.nav-sidebar a').all_inner_texts()]
    labels = [t for t in labels if t]
    missing = [n for n in EXPECTED_NAV if not any(n in t for t in labels)]
    unexpected = [t for t in labels
                  if not any(n in t for n in EXPECTED_NAV) and len(t) < 24]
    check('nav shows exactly the expected entries',
          [f'missing: {m}' for m in missing] + [f'unexpected: {u}' for u in unexpected])

    # --- live routes ------------------------------------------------------
    for route in LIVE_ROUTES:
        rec.reset()
        hash_route(page, base, route, entry)
        problems = rec.problems()
        if current_route(page).split('?')[0] == '':
            problems.append('did not navigate')
        check(f'live route {route} loads cleanly', problems)

    # --- removed routes ---------------------------------------------------
    for route in REMOVED_ROUTES:
        rec.reset()
        hash_route(page, base, route, entry)
        landed = current_route(page).split('?')[0]
        problems = []
        if landed.startswith(route):
            problems.append(f'still renders (url is {landed})')
        problems += rec.problems()
        check(f'removed route {route} does not render', problems)

    # --- the tooltip template that import analysis cannot see -------------
    rec.reset()
    hash_route(page, base, '/servers', entry)
    template = page.evaluate(
        """async () => {
             const r = await fetch('/ui/app/components/directives/'
                 + 'mn_encryption_status/mn_encryption_status_template.html');
             return r.status;
           }""")
    check('encryption-status tooltip template is served',
          [] if template == 200 else [f'GET returned {template}'])

    return results


def main():
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--url', help='base URL of a running cluster, e.g. http://127.0.0.1:8091')
    parser.add_argument('--user', default='Administrator')
    parser.add_argument('--password')
    parser.add_argument('--serve-source', action='store_true',
                        help='serve src/ui with a stub REST API instead of using a cluster')
    parser.add_argument('--entry', default='index-dev.html',
                        choices=['index-dev.html', 'index.html'],
                        help='index-dev.html (default) loads the working tree straight from '
                             'the symlinked source, so no make install is needed; index.html '
                             'exercises the built bundle')
    parser.add_argument('--junit-xml', help='write a JUnit report here')
    parser.add_argument('--headed', action='store_true', help='show the browser')
    args = parser.parse_args()

    if not args.url and not args.serve_source:
        parser.error('pass --url <cluster>, or --serve-source for the hermetic run')
    if args.url and not args.password:
        parser.error('--password is required with --url')

    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print('playwright is not installed:\n'
              '    pip install playwright && playwright install chromium', file=sys.stderr)
        return 1

    server = None
    if args.serve_source:
        server, base = serve_source()
        print(f'serving {UI} at {base}\n')
    else:
        base = args.url.rstrip('/')
        print(f'testing {base}\n')

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=not args.headed)
            page = browser.new_page(viewport={'width': 1440, 'height': 900})
            try:
                results = run(page, base, args.user, args.password,
                                  args.serve_source, args.entry)
            finally:
                browser.close()
    finally:
        if server:
            server.shutdown()

    if args.junit_xml:
        junit_xml.write(args.junit_xml, 'ui.smoke',
                        [(name, '\n'.join(problems) if problems else None, seconds)
                         for name, problems, seconds in results])

    failed = [name for name, problems, _ in results if problems]
    print()
    if failed:
        print(f'{len(failed)} of {len(results)} checks failed')
        return 1
    print(f'all {len(results)} checks passed')
    return 0


if __name__ == '__main__':
    sys.exit(main())
