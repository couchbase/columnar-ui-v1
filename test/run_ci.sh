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

smoke() {
    if ! docker info >/dev/null 2>&1; then
        echo "docker is not available; the browser layer needs it" >&2
        return 1
    fi
    echo "using $PLAYWRIGHT_IMAGE"

    # The sources are copied in rather than bind-mounted. On these agents the
    # docker daemon does not share the workspace filesystem, and a -v of a path
    # the daemon cannot see silently mounts an empty directory - the test then
    # fails with "can't open file", which reads like a missing file rather than
    # a missing mount. docker cp works whether the daemon is local or not.
    local stage cid rc
    stage=$(mktemp -d) || return 1
    cp -R src test "$stage"/ || { rm -rf "$stage"; return 1; }

    # --ipc=host is playwright's recommendation; chromium can exhaust the
    # default 64MB /dev/shm and crash mid-run otherwise.
    cid=$(docker create --init --ipc=host -e HOME=/tmp -w /work \
        "$PLAYWRIGHT_IMAGE" \
        bash -c "pip install --quiet --no-warn-script-location \
                     --disable-pip-version-check --root-user-action=ignore \
                     playwright==$PLAYWRIGHT_VERSION &&
                 python test/test_ui_smoke.py --serve-source \
                        --junit-xml /work/ui-smoke.xml") || { rm -rf "$stage"; return 1; }

    # The "/." matters: -w already created /work, and docker cp copies a source
    # directory *into* an existing destination. Without it the tree lands at
    # /work/<tmpname>/ and the test looks like a missing file.
    docker cp "$stage/." "$cid:/work" >/dev/null || { rm -rf "$stage"; docker rm -f "$cid" >/dev/null; return 1; }
    rm -rf "$stage"

    docker start -a "$cid"
    rc=$?
    # Copy the report out even on failure: it carries the per-case detail.
    docker cp "$cid:/work/ui-smoke.xml" "$REPORTS/ui-smoke.xml" >/dev/null 2>&1
    docker rm -f "$cid" >/dev/null 2>&1
    return $rc
}

run "structural checks"        python3 test/check_ui.py       --junit-xml "$REPORTS/ui-check.xml"
run "checks-for-the-checks"    python3 test/test_check_ui.py  --junit-xml "$REPORTS/ui-check-meta.xml"
run "browser smoke (hermetic)" smoke

echo
if [ "$status" -ne 0 ]; then
    echo "### one or more UI test layers failed"
else
    echo "### all UI test layers passed"
fi
exit "$status"
