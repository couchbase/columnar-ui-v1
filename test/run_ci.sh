#!/usr/bin/env bash
#
# Entry point for the UI test CI job. Needs python3 only - no product build,
# no cluster, no JDK, no maven, no third-party packages.
#
#   test/run_ci.sh
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

run "structural checks"        python3 test/check_ui.py       --junit-xml "$REPORTS/ui-check.xml"
run "checks-for-the-checks"    python3 test/test_check_ui.py  --junit-xml "$REPORTS/ui-check-meta.xml"

echo
if [ "$status" -ne 0 ]; then
    echo "### one or more UI test layers failed"
else
    echo "### all UI test layers passed"
fi
exit "$status"
