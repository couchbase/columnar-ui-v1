/*
Copyright 2021-Present Couchbase, Inc.

Use of this software is governed by the Business Source License included in
the file licenses/BSL-Couchbase.txt.  As of the Change Date specified in that
file, in accordance with the Business Source License, use of this software will
be governed by the Apache License, Version 2.0, included in the file
licenses/APL2.txt.
*/

import { Component, ChangeDetectionStrategy } from '/ui/web_modules/@angular/core.js';

export { MnSettingsAutoCompactionTimePeriodComponent };

class MnSettingsAutoCompactionTimePeriodComponent {
  static get annotations() { return [
    new Component({
      selector: "mn-time-period",
      templateUrl: "app/mn.settings.auto.compaction.time.period.html",
      changeDetection: ChangeDetectionStrategy.OnPush,
      inputs: [
        'mnGroup',
        'mnErrors',
        'mnKey'
      ]
    })
  ]}

  static get parameters() { return []}

  constructor() {}
}
