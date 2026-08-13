"""Minimal JUnit XML writer.

Jenkins' JUnitResultArchiver already collects **/target/surefire-reports/*.xml
in the analytics jobs, so emitting that format means the Python tests show up as
individual cases in the build - and in the gerrit comment - instead of a single
pass/fail blob. Nothing here needs a test framework; the suites are small and
their results are already structured.
"""

import os
from xml.sax.saxutils import escape, quoteattr


def write(path, suite, cases):
    """Write a JUnit report.

    cases is a sequence of (name, failure_text_or_None, seconds). A case with
    failure text is reported failed, with the text as the failure body.
    """
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    failures = sum(1 for _, failure, _ in cases if failure)
    total_time = sum(seconds for _, _, seconds in cases)

    lines = ['<?xml version="1.0" encoding="UTF-8"?>',
             f'<testsuite name={quoteattr(suite)} tests="{len(cases)}" '
             f'failures="{failures}" errors="0" skipped="0" time="{total_time:.3f}">']
    for name, failure, seconds in cases:
        attrs = (f'classname={quoteattr(suite)} name={quoteattr(name)} '
                 f'time="{seconds:.3f}"')
        if failure:
            lines.append(f'  <testcase {attrs}>')
            lines.append(f'    <failure message={quoteattr(failure.splitlines()[0][:200])}>'
                         f'{escape(failure)}</failure>')
            lines.append('  </testcase>')
        else:
            lines.append(f'  <testcase {attrs}/>')
    lines.append('</testsuite>')

    with open(path, 'w', encoding='utf-8') as fh:
        fh.write('\n'.join(lines) + '\n')
    return path
