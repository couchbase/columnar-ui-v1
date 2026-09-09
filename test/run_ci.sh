#!/usr/bin/env bash
#
# Entry point for the UI test CI job.
#
#   test/run_ci.sh
#
# The structural layers need python3 and nothing else. The browser layer runs
# in the official playwright image: a bare Jenkins agent does not have
# chromium's shared libraries (libglib-2.0 and friends) and installing them
# needs root. Docker is already required on these agents by testcontainers, so
# this adds no new capability, and the image ships playwright and its browsers
# so nothing is downloaded at test time.
#
# No product build, no cluster, no JDK, no maven.
#
# Writes JUnit reports to target/surefire-reports/, which is the pattern the
# analytics jobs' JUnitResultArchiver already collects, so each check shows up
# as its own case in Jenkins and in the gerrit comment.
#
# Runs every layer even if an earlier one fails, so one run reports everything
# that is broken rather than only the first thing.
#
# The cbas-ui layers additionally need the cbas-ui project checked out beside
# this one; set CBAS_UI to point elsewhere.

set -u -o pipefail

cd "$(dirname "$0")/.."
REPORTS="target/surefire-reports"
mkdir -p "$REPORTS"

# Pinned so a run is reproducible. The image carries the browsers and the system
# libraries but not the python package, so that is installed at the matching
# version inside the container - a few seconds, and no browser download because
# the image already sets PLAYWRIGHT_BROWSERS_PATH=/ms-playwright.
PLAYWRIGHT_VERSION="${PLAYWRIGHT_VERSION:-1.62.0}"
PLAYWRIGHT_IMAGE="${PLAYWRIGHT_IMAGE:-mcr.microsoft.com/playwright/python:v${PLAYWRIGHT_VERSION}-noble}"

status=0

run() {
    local label="$1"; shift
    echo
    echo "### $label"
    if ! "$@"; then
        echo "### $label FAILED"
        status=1
    fi
}

# Runs one command inside the playwright image, with src/ and test/ staged at
# /work along with any extra trees named after the command as name=path pairs.
# Anything it writes to /work/reports is copied back out, failure or not: those
# files carry the per-case detail.
in_playwright() {
    local command="$1"; shift
    if ! docker info >/dev/null 2>&1; then
        echo "docker is not available; the browser layers need it" >&2
        return 1
    fi
    echo "using $PLAYWRIGHT_IMAGE"

    # The sources are copied in rather than bind-mounted. On these agents the
    # docker daemon does not share the workspace filesystem, and a -v of a path
    # the daemon cannot see silently mounts an empty directory - the test then
    # fails with "can't open file", which reads like a missing file rather than
    # a missing mount. docker cp works whether the daemon is local or not.
    local stage cid rc extra
    stage=$(mktemp -d) || return 1
    cp -R src test "$stage"/ || { rm -rf "$stage"; return 1; }
    # name=path, so a tree staged from elsewhere still lands where the command
    # expects it rather than under whatever the source directory was called.
    for extra in "$@"; do
        cp -R "${extra#*=}" "$stage/${extra%%=*}" || { rm -rf "$stage"; return 1; }
    done

    # --ipc=host is playwright's recommendation; chromium can exhaust the
    # default 64MB /dev/shm and crash mid-run otherwise.
    cid=$(docker create --init --ipc=host -e HOME=/tmp -w /work \
        "$PLAYWRIGHT_IMAGE" \
        bash -c "pip install --quiet --no-warn-script-location \
                     --disable-pip-version-check --root-user-action=ignore \
                     playwright==$PLAYWRIGHT_VERSION &&
                 mkdir -p /work/reports && $command") || { rm -rf "$stage"; return 1; }

    # The "/." matters: -w already created /work, and docker cp copies a source
    # directory *into* an existing destination. Without it the tree lands at
    # /work/<tmpname>/ and the test looks like a missing file.
    docker cp "$stage/." "$cid:/work" >/dev/null || { rm -rf "$stage"; docker rm -f "$cid" >/dev/null; return 1; }
    rm -rf "$stage"

    docker start -a "$cid"
    rc=$?
    docker cp "$cid:/work/reports/." "$REPORTS/" >/dev/null 2>&1
    docker rm -f "$cid" >/dev/null 2>&1
    return $rc
}

smoke() {
    in_playwright "python test/test_ui_smoke.py --serve-source \
                          --junit-xml /work/reports/ui-smoke.xml"
}

# The analytics workbench is a pluggable UI in the sibling cbas-ui project, but
# the browser it runs in is this repo's: it imports angular, lodash, ace and the
# ns_server components through src/ui's importmap and vendors none of them. Both
# layers run in one container so the image is prepared once, and both always
# run, so one report says everything that is broken.
cbas_dialogs() {
    local cbas_ui="${CBAS_UI:-$(cd .. && pwd)/cbas-ui}"
    if [ ! -f "$cbas_ui/cbas-ui/cw_cbas_controller.js" ]; then
        echo "no cbas-ui checkout at $cbas_ui" >&2
        echo "set CBAS_UI, or sync the cbas-ui project beside this one" >&2
        return 1
    fi
    in_playwright "status=0
                   python test/test_cbas_dialogs.py --cbas-ui /work/cbas-ui/cbas-ui \
                          --junit-xml /work/reports/cbas-dialogs.xml || status=1
                   echo; echo '### cbas-ui tests-for-the-tests'
                   python test/test_cbas_mutations.py --cbas-ui /work/cbas-ui/cbas-ui \
                          --junit-xml /work/reports/cbas-mutations.xml || status=1
                   exit \$status" "cbas-ui=$cbas_ui"
}

run "structural checks"        python3 test/check_ui.py       --junit-xml "$REPORTS/ui-check.xml"
run "checks-for-the-checks"    python3 test/test_check_ui.py  --junit-xml "$REPORTS/ui-check-meta.xml"
run "browser smoke (hermetic)" smoke
run "cbas-ui dialogs"          cbas_dialogs

echo
if [ "$status" -ne 0 ]; then
    echo "### one or more UI test layers failed"
else
    echo "### all UI test layers passed"
fi
exit "$status"
