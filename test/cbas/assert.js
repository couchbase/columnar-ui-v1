/*
Copyright 2026-Present Couchbase, Inc.

Use of this software is governed by the Business Source License included in
the file licenses/BSL-Couchbase.txt.  As of the Change Date specified in that
file, in accordance with the Business Source License, use of this software will
be governed by the Apache License, Version 2.0, included in the file
licenses/APL2.txt.
*/

export function ok(value, message) {
  if (!value) {
    throw new Error(message || 'expected a truthy value, got ' + JSON.stringify(value));
  }
}

export function equal(actual, expected, message) {
  if (actual !== expected) {
    throw new Error((message ? message + ': ' : '') +
                    'expected ' + JSON.stringify(expected) + ', got ' + JSON.stringify(actual));
  }
}

export function contains(haystack, needle, message) {
  if (String(haystack).indexOf(needle) < 0) {
    throw new Error((message ? message + ': ' : '') +
                    'expected to find ' + JSON.stringify(needle) + ' in ' + JSON.stringify(haystack));
  }
}

export function omits(haystack, needle, message) {
  if (String(haystack).indexOf(needle) >= 0) {
    throw new Error((message ? message + ': ' : '') +
                    'expected NOT to find ' + JSON.stringify(needle) + ' in ' + JSON.stringify(haystack));
  }
}
