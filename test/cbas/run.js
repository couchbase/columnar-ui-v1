/*
Copyright 2026-Present Couchbase, Inc.

Use of this software is governed by the Business Source License included in
the file licenses/BSL-Couchbase.txt.  As of the Change Date specified in that
file, in accordance with the Business Source License, use of this software will
be governed by the Apache License, Version 2.0, included in the file
licenses/APL2.txt.
*/

// Runs the cases and parks the results on window for the python driver to
// collect. Nothing here is a test framework: each case is a function that
// throws, and a case that throws is a failure.

import cases from "./cases.js";
import rbacCases from "./rbac_cases.js";
import usersCases from "./users_cases.js";

const results = [];
for (const [name, fn] of cases.concat(rbacCases).concat(usersCases)) {
  const started = performance.now();
  let failure = null;
  try {
    fn();
  } catch (error) {
    failure = (error && error.stack) || String(error);
  }
  results.push({name, failure, seconds: (performance.now() - started) / 1000});
}
window.__cbasTestResults = results;
