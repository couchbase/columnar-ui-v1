#!/usr/bin/env python3
"""Tests for test_cbas_dialogs.py: each case here breaks cbas-ui on purpose.

A test that cannot fail is worse than no test, because it reads as coverage.
Every entry below removes or corrupts one decision the dialogs make, copies the
UI tree with that damage in place, and asserts that some case in
test/cbas/cases.js notices. A mutation that no longer applies is a failure
too - otherwise it quietly stops testing anything the day the code it patches
is reworded.

    python3 test/test_cbas_mutations.py

Same requirements as test_cbas_dialogs.py: playwright and the sibling cbas-ui
checkout. One browser serves the whole run.
"""

import argparse
import os
import shutil
import sys
import tempfile
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import junit_xml
import test_cbas_dialogs

# (name, file, text to find, what to replace it with). The name says what the
# product would then do wrong, not which line moved.
MUTATIONS = [
    ('a vending catalog no longer says so in its DDL',
     'cw_query_service.js',
     """    if (options.vendedCredentials) {
      withOptions.push('"vendedCredentials": "true"');
    }""",
     ''),

    ('a vending collection is still created AT a link',
     'cw_cbas_controller.js',
     """(opts.vendedCredentials ? `` : ` AT \\`${opts.selectedLink}\\``) +""",
     """` AT \\`${opts.selectedLink}\\`` +"""),

    ('the vending property is read raw from the metadata, not as a string',
     'cw_query_service.js',
     """VendedCredentials: String(record.VendedCredentials).toLowerCase() === "true\"""",
     """VendedCredentials: record.VendedCredentials"""),

    ('the metadata query stops asking for the vending property',
     'cw_constants_service.js',
     """  )[0] AS VendedCredentials, ""","""  )[0] AS NotVendedCredentials, """),

    ('the "Other" signing region reaches the server literally',
     'cw_query_service.js',
     """      if (key === "sigv4SigningRegion" && value === "Other") {
        value = options.other_sigv4_region;
      }""",
     ''),

    ('a source that cannot vend keeps the vending flag it was left with',
     'cw_cbas_controller.js',
     """        if (!createNewCatalogDialogScope.sourceCanVendCredentials()) {
          createNewCatalogDialogScope.options.vendedCredentials = false;
        }""",
     ''),

    ('a catalog that does not vend keeps the vending flag it was left with',
     'cw_cbas_controller.js',
     """          if (!dialogScope.catalogVendsCredentials()) {
            dialogScope.options.vendedCredentials = false;
          }""",
     ''),

    ('the signing region is no longer preselected from the link',
     'cw_cbas_controller.js',
     """        if (createNewCatalogDialogScope.getAwsRegions().indexOf(info.region) >= 0) {""",
     """        if (false) {"""),

    ('the signing name is left pointing at an option the select lost',
     'cw_cbas_controller.js',
     """        createNewCatalogDialogScope.options.catalog_params.sigv4SigningName = "glue";""",
     ''),

    ('vending is offered by every catalog source, not only the REST ones',
     'cw_cbas_controller.js',
     """        return cwConstantsService.icebergVendingEnabled
          && cwConstantsService.vendedCredentialsCatalogSources
            .indexOf(createNewCatalogDialogScope.options.catalog_source) >= 0;""",
     """        return cwConstantsService.icebergVendingEnabled;"""),

    ('the feature flag stops hiding the option',
     'cw_constants_service.js',
     """  cwConstantsService.icebergVendingEnabled = false;""",
     """  cwConstantsService.icebergVendingEnabled = true;"""),

    ('a source in the vending list is spelled in a way nothing matches',
     'cw_constants_service.js',
     '''"S3_TABLES", "BIGLAKE_METASTORE"]''',
     '''"S3_TABLE", "BIGLAKE_METASTORE"]'''),

    # The markup half. An ng-if naming a function the scope does not have is
    # simply always false, so the option silently never appears - nothing but a
    # rendered template can catch it.
    ('the catalog checkbox is guarded by a scope function that does not exist',
     'cw_cbas_catalog_dialog.html',
     """ng-if="sourceCanVendCredentials()\"""",
     """ng-if="sourceCanVendCredential()\""""),

    ('the collection checkbox writes to a model nothing reads',
     'cw_cbas_iceberg_collection_dialog.html',
     """          ng-model="options.vendedCredentials"
          type="checkbox">""",
     """          ng-model="options.vendCredentials"
          type="checkbox">"""),

    ('a vending collection still demands a link in the form',
     'cw_cbas_iceberg_collection_dialog.html',
     """                ng-required="!options.vendedCredentials"
                ng-disabled="options.vendedCredentials\"""",
     ''),
]


def mutate(cbas_ui, filename, old, new):
    """Copy the cbas-ui tree with one change applied; None if the text is gone."""
    root = os.path.join(tempfile.mkdtemp(), 'cbas-ui')
    shutil.copytree(cbas_ui, root)
    path = os.path.join(root, filename)
    with open(path, encoding='utf-8') as fh:
        text = fh.read()
    if old not in text:
        shutil.rmtree(os.path.dirname(root))
        return None
    with open(path, 'w', encoding='utf-8') as fh:
        fh.write(text.replace(old, new, 1))
    return root


def main():
    parser = test_cbas_dialogs.add_arguments(argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter))
    args = parser.parse_args()

    if not test_cbas_dialogs.check_cbas_ui(args.cbas_ui):
        return 1

    cases = []
    with test_cbas_dialogs.browser() as instance:
        # The real tree has to pass first. Without this a mutation that fails
        # for some unrelated reason would still be reported as detected.
        started = time.time()
        baseline = [name for name, failure, _ in
                    test_cbas_dialogs.run(instance, args.cbas_ui)
                    if failure]
        cases.append(('unmodified tree passes',
                      'these cases fail before any mutation:\n  ' + '\n  '.join(baseline)
                      if baseline else None,
                      time.time() - started))

        for name, filename, old, new in MUTATIONS:
            started = time.time()
            root = mutate(args.cbas_ui, filename, old, new)
            if root is None:
                cases.append((name, f'this mutation no longer applies: the text it '
                                    f'replaces is gone from {filename}. Update it, or '
                                    f'it is testing nothing.', time.time() - started))
                continue
            try:
                failures = [case for case, failure, _ in
                            test_cbas_dialogs.run(instance, root) if failure]
            finally:
                shutil.rmtree(os.path.dirname(root))
            cases.append((name,
                          None if failures else 'no case failed; this breakage would ship',
                          time.time() - started))

    failed = 0
    for name, failure, _ in cases:
        if failure:
            failed += 1
            print(f'FAIL  {name}')
            for line in failure.splitlines():
                print(f'      {line}')
        else:
            print(f'ok    caught: {name}')

    if args.junit_xml:
        junit_xml.write(args.junit_xml, 'ui.cbas_mutations', cases)

    print()
    if failed:
        print(f'{failed} of {len(cases)} mutations went undetected')
        return 1
    print(f'all {len(cases) - 1} mutations detected')
    return 0


if __name__ == '__main__':
    sys.exit(main())
