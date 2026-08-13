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
import re
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
        # Some requests fail on every page of a healthy cluster (an unset RBAC
        # profile 404s, for instance). Asserting "zero failures" per route would
        # report those against whichever route ran first, so what is already
        # failing when we reach the admin UI is adopted as a baseline and
        # subtracted from later routes. Only *new* failures are reported.
        self.baseline = set()
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

    @staticmethod
    def _key(kind, text):
        if kind == 'response':
            status, _, url = text.partition(' ')
            return kind, status, url.split('?', 1)[0]
        return kind, text

    def adopt_baseline(self):
        """Treat everything currently recorded as pre-existing noise."""
        for c in self.console:
            self.baseline.add(self._key('console', c))
        for r in self.responses:
            self.baseline.add(self._key('response', r))
        self.reset()
        return len(self.baseline)

    def problems(self):
        out = []
        for c in self.console:
            if self._key('console', c) not in self.baseline:
                out.append(f'console: {c}')
        for r in self.responses:
            if self._key('response', r) not in self.baseline:
                out.append(f'response: {r}')
        return out


def hash_route(page, base, route, entry):
    # The app sets $locationProvider.hashPrefix(""), so routes are "#/servers",
    # not "#!/servers". Getting this wrong does not error - the browser simply
    # never navigates, and every route assertion then passes vacuously.
    page.goto(f'{base}/ui/{entry}#{route}', wait_until='domcontentloaded')
    page.wait_for_timeout(2500)


def current_route(page):
    url = page.url
    return url.split('#', 1)[1] if '#' in url else ''


def click_styled(page, control_id):
    """Toggle a checkbox/radio through its label.

    These controls are positioned off-viewport for styling, so check() fails
    with "outside of the viewport" and force=True does not help. The label is
    the visible hit target - clicked near its left edge, because the terms
    label wraps the terms-and-conditions hyperlink and a centre click opens
    that link instead of toggling the control.
    """
    page.locator(f'label[for="{control_id}"]').click(position={'x': 6, 'y': 6})


def run_wizard(page, check, opts):
    """Configure a fresh cluster through the setup wizard.

    Deliberately no REST calls: the point is to exercise the wizard's own
    forms, so a break in mn.wizard.* or mn-columnar-bucket-config fails here
    rather than being bypassed.
    """
    page.click('text=Setup New Cluster')
    page.wait_for_timeout(2000)
    page.fill('#for-cluster-name-field', opts.cluster_name)
    page.fill('#secure-username', opts.user)
    page.fill('#secure-password', opts.password)
    page.fill('#secure-password-verify', opts.password)
    page.click('button[type="submit"]')
    page.wait_for_timeout(2500)

    on_terms = page.locator('#for-accept-terms').count() > 0
    check('wizard reaches the terms step', [] if on_terms else ['no terms checkbox'])
    if not on_terms:
        return False
    click_styled(page, 'for-accept-terms')
    page.click('button[type="submit"]')
    page.wait_for_timeout(3000)

    # "S3-compatible" is what exposes an endpoint field at all; plain S3 has no
    # endpoint input. Note the cluster stores this as scheme "s3" plus an
    # endpoint and path-style addressing, not as "s3-compat".
    if page.locator('#s3-compat').count() == 0:
        check('wizard reaches blob storage configuration', ['no blob storage scheme controls'])
        return False
    click_styled(page, 's3-compat')
    page.wait_for_timeout(800)
    if page.locator('#bucket_endpoint').count() == 0:
        check('selecting S3-compatible reveals the endpoint field',
              ['#bucket_endpoint absent after choosing s3-compat'])
        return False
    check('wizard reaches blob storage configuration', [])

    page.fill('#bucket_endpoint', opts.s3_endpoint)
    page.fill('#bucket_name', opts.s3_bucket)
    page.fill('#bucket_region', opts.s3_region)
    page.fill('#bucket_path_prefix', opts.s3_prefix)
    click_styled(page, 'cred-mode-anonymous')
    page.wait_for_timeout(400)
    check('anonymous credential mode selected',
          [] if page.is_checked('#cred-mode-anonymous') else ['not selected'])

    page.click('button[type="submit"]')
    # Initialising the cluster and bringing analytics up takes a while.
    for _ in range(60):
        page.wait_for_timeout(1000)
        if page.locator('nav.nav-sidebar').count() > 0:
            break
    signed_in = page.locator('nav.nav-sidebar').count() > 0
    check('wizard completes and lands in the admin UI',
          [] if signed_in else [f'no nav sidebar; url={page.url}'])
    return signed_in


def verify_blob_storage(page, check, opts):
    """The settings the cluster ended up with must match what we typed."""
    settings = page.evaluate(
        """async () => {
             const r = await fetch('/settings/analytics',
                                   {headers: {'ns-server-ui': 'yes'}});
             return r.ok ? await r.json() : {__status: r.status};
           }""")
    if not settings or '__status' in settings:
        status = (settings or {}).get('__status', 'no response')
        check('blob storage settings readable',
              [f'GET /settings/analytics returned {status}'])
        return
    problems = []
    for key, expected in (('blobStorageBucket', opts.s3_bucket),
                          ('blobStorageRegion', opts.s3_region),
                          ('blobStoragePrefix', opts.s3_prefix),
                          ('blobStorageEndpoint', opts.s3_endpoint)):
        if settings.get(key) != expected:
            problems.append(f'{key}: {settings.get(key)!r} != {expected!r}')
    if settings.get('blobStorageAnonymousAuth') is not True:
        problems.append(f'blobStorageAnonymousAuth: {settings.get("blobStorageAnonymousAuth")!r}')
    check('blob storage was configured through the UI', problems)


# --- Analytics workbench ----------------------------------------------------
# These drive the cbas-ui pluggable UI rather than its REST API: the point is
# that the workbench itself works, so a break in the editor, the execute button
# or the results pane fails here instead of being bypassed.
#
# TODO: link creation (S3/Azure/GCS external links) once there is a mock to
# point them at.
# TODO: RBAC - create a limited user and assert the workbench honours it.

WORKBENCH_SAMPLE = 'travel-sample'
SAMPLE_SCOPE = 'inventory'
# travel-sample creates these as standalone (INTERNAL) collections.
SAMPLE_COLLECTIONS = ['airline', 'airport', 'hotel', 'landmark', 'route']


def workbench_query(page, sql, timeout_ms=20000):
    """Type a query into the workbench editor and execute it.

    Returns (status, results_text). The results pane is an ace editor, so its
    text carries ace's gutter line numbers; callers match substrings rather
    than parsing it strictly.
    """
    page.click('.wb-ace-editor')
    page.wait_for_timeout(300)
    # clear whatever the previous query left behind
    page.keyboard.press('Control+A')
    page.keyboard.press('Meta+A')
    page.keyboard.press('Backspace')
    page.keyboard.type(sql)
    page.wait_for_timeout(200)
    page.click('button.wb-button-execute')

    deadline = timeout_ms
    status = ''
    while deadline > 0:
        page.wait_for_timeout(500)
        deadline -= 500
        if page.locator('.wb-result-status').count():
            status = page.locator('.wb-result-status').first.inner_text().strip()
            if status and 'executing' not in status.lower():
                break
    results = ''
    if page.locator('.wb-results-json').count():
        results = ' '.join(page.locator('.wb-results-json').first.inner_text().split())
    return status, results


def wait_for_analytics(page, check, timeout_s=240):
    """Wait for the analytics service to register with ns_server.

    Right after the wizard the cluster is initialised but cbas is still coming
    up - it has to bootstrap its storage against the blob endpoint first - and
    until it registers, ns_server's _p/cbas proxy answers 404 for everything.
    The UI polls through that proxy from the dashboard, so asserting routes
    before this settles reports a transient 404 as a page failure. Waiting is
    better than ignoring the endpoint: it asserts something true, and a service
    that never comes up is a real failure rather than a suppressed one.
    """
    waited = 0
    while waited < timeout_s:
        status = page.evaluate(
            """async () => {
                 try {
                   const r = await fetch('/_p/cbas/api/v1/samples',
                                         {headers: {'ns-server-ui': 'yes'}});
                   return r.status;
                 } catch (e) { return 0; }
               }""")
        if status and status != 404:
            check(f'analytics service is available (after {waited}s)', [])
            return True
        page.wait_for_timeout(5000)
        waited += 5
    check('analytics service is available', [f'_p/cbas still 404 after {timeout_s}s'])
    return False


def run_workbench(page, base, check, entry):
    """Query, install travel-sample, then query what the sample created."""
    hash_route(page, base, '/cbas/workbench', entry)
    page.wait_for_timeout(4000)
    if page.locator('.wb-ace-editor').count() == 0:
        check('workbench is available', ['no query editor - is the cbas pluggable UI installed?'])
        return
    check('workbench is available', [])

    status, results = workbench_query(page, 'SELECT 1;')
    problems = []
    if 'success' not in status.lower():
        problems.append(f'status was {status!r}')
    if '"$1": 1' not in results:
        problems.append(f'unexpected results: {results[:120]}')
    check('workbench runs SELECT 1', problems)

    # --- install travel-sample through the samples page ---------------------
    hash_route(page, base, '/cbas/samples', entry)
    page.wait_for_timeout(3000)
    available = page.evaluate(
        """async () => {
             const r = await fetch('/_p/cbas/api/v1/samples',
                                   {headers: {'ns-server-ui': 'yes'}});
             return r.ok ? await r.json() : null;
           }""")
    if available is None:
        check('samples page lists travel-sample', ['GET /_p/cbas/api/v1/samples failed'])
        return
    if WORKBENCH_SAMPLE in available:
        if page.locator('#travelSample').count() == 0:
            check('samples page lists travel-sample', ['no travel-sample checkbox'])
            return
        check('samples page lists travel-sample', [])
        # styled checkbox again: the input is off-viewport, the label is the target
        if not page.is_checked('#travelSample'):
            page.locator('label[for="travelSample"]').click(position={'x': 6, 'y': 6})
            page.wait_for_timeout(400)
        page.click('button:has-text("Load Sample Data")')
        # The POST only starts the load; the sample is ready when the server
        # stops offering it as available.
        installed = False
        for _ in range(60):
            page.wait_for_timeout(5000)
            still = page.evaluate(
                """async () => {
                     const r = await fetch('/_p/cbas/api/v1/samples',
                                           {headers: {'ns-server-ui': 'yes'}});
                     return r.ok ? await r.json() : null;
                   }""")
            if still is not None and WORKBENCH_SAMPLE not in still:
                installed = True
                break
        check(f'{WORKBENCH_SAMPLE} installs from the samples page',
              [] if installed else ['still listed as available after 5 minutes'])
        if not installed:
            return
    else:
        check('samples page lists travel-sample', [])
        check(f'{WORKBENCH_SAMPLE} installs from the samples page', [])

    # --- query what the sample created --------------------------------------
    hash_route(page, base, '/cbas/workbench', entry)
    page.wait_for_timeout(4000)
    status, results = workbench_query(
        page,
        'SELECT VALUE d.DatasetName FROM Metadata.`Dataset` d '
        f'WHERE d.DatabaseName = "{WORKBENCH_SAMPLE}" AND d.DatasetType = "INTERNAL" '
        'ORDER BY d.DatasetName;')
    missing = [c for c in SAMPLE_COLLECTIONS if f'"{c}"' not in results]
    check(f'{WORKBENCH_SAMPLE} standalone collections exist',
          ([f'status was {status!r}'] if 'success' not in status.lower() else [])
          + [f'missing collection: {m}' for m in missing])

    collection = SAMPLE_COLLECTIONS[0]
    status, results = workbench_query(
        page, f'SELECT VALUE COUNT(*) FROM `{WORKBENCH_SAMPLE}`.{SAMPLE_SCOPE}.{collection};',
        timeout_ms=60000)
    counts = [int(n) for n in re.findall(r'\b(\d+)\b', results)]
    problems = []
    if 'success' not in status.lower():
        problems.append(f'status was {status!r}')
    elif not any(c > 0 for c in counts):
        problems.append(f'no positive row count in {results[:120]}')
    check(f'standalone collection {SAMPLE_SCOPE}.{collection} is queryable', problems)


def run(page, base, opts, hermetic, entry):
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

    # --- setup or sign in --------------------------------------------------
    rec.reset()
    wizard_ran = False
    if opts.wizard and page.locator('text=Setup New Cluster').count() > 0:
        wizard_ran = True
        if not run_wizard(page, check, opts):
            return results
    elif opts.wizard:
        check('cluster is uninitialised for the wizard run',
              ['no "Setup New Cluster" button - this cluster is already set up; '
               'start a fresh one or drop --wizard'])
        return results
    else:
        if page.locator('#auth-password-input').count() > 0:
            page.fill('#auth-username-input', opts.user)
            page.fill('#auth-password-input', opts.password)
            page.click('button[type="submit"]')
            page.wait_for_timeout(4000)
        signed_in = page.locator('nav.nav-sidebar').count() > 0
        check('sign in reaches the admin UI',
              [] if signed_in else ['no nav sidebar after login'])
        if not signed_in:
            return results

    if wizard_ran:
        verify_blob_storage(page, check, opts)

    # cbas registers a little after cluster init; until it does, the dashboard's
    # polls through the _p/cbas proxy 404. Settle that before snapshotting.
    wait_for_analytics(page, check)

    # Everything failing right now is pre-existing: adopt it so the per-route
    # checks below report only what each route newly breaks.
    adopted = rec.adopt_baseline()
    print(f'      (baseline: {adopted} pre-existing failure(s) ignored from here)')

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

    # --- analytics workbench ----------------------------------------------
    if opts.workbench:
        rec.reset()
        run_workbench(page, base, check, entry)

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
    parser.add_argument('--workbench', action='store_true',
                        help='also exercise the analytics workbench: run a query, install '
                             'travel-sample, and query a standalone collection it creates')
    parser.add_argument('--wizard', action='store_true',
                        help='configure a fresh cluster through the setup wizard '
                             'instead of signing in to an existing one')
    parser.add_argument('--cluster-name', default='ea-ui-it')
    parser.add_argument('--s3-endpoint', default='http://host.docker.internal:9090',
                        help='blob storage endpoint as the *cluster* sees it')
    parser.add_argument('--s3-bucket', default='ea-it-bucket')
    parser.add_argument('--s3-region', default='us-east-1')
    parser.add_argument('--s3-prefix', default='eaIT/')
    parser.add_argument('--serve-source', action='store_true',
                        help='serve src/ui with a stub REST API instead of using a cluster')
    parser.add_argument('--entry', default='index-dev.html',
                        choices=['index-dev.html', 'index.html'],
                        help='index-dev.html (default) loads the working tree straight from '
                             'the symlinked source, so no make install is needed; index.html '
                             'exercises the built bundle')
    parser.add_argument('--junit-xml', help='write a JUnit report here')
    parser.add_argument('--junit-suite', default='ui.smoke',
                        help='suite name in the JUnit report. UiSmokeIT passes its own '
                             'package so these cases group with it rather than under a '
                             'stray top-level "ui" package')
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
                results = run(page, base, args, args.serve_source, args.entry)
            finally:
                browser.close()
    finally:
        if server:
            server.shutdown()

    if args.junit_xml:
        junit_xml.write(args.junit_xml, args.junit_suite,
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
