/*
Copyright 2020-Present Couchbase, Inc.

Use of this software is governed by the Business Source License included in
the file licenses/BSL-Couchbase.txt.  As of the Change Date specified in that
file, in accordance with the Business Source License, use of this software will
be governed by the Apache License, Version 2.0, included in the file
licenses/APL2.txt.
*/

import {Component, ChangeDetectionStrategy} from '@angular/core';
import {takeUntil, pluck, distinctUntilChanged} from 'rxjs/operators';
import {BehaviorSubject} from 'rxjs';

import {MnPoolsService} from './mn.pools.service.js';
import {MnWizardService} from './mn.wizard.service.js';
import {MnLifeCycleHooksToStream} from './mn.core.js';
import template from "./mn.columnar.bucket.config.html"

export {MnColumnarbucketConfig};

class MnColumnarbucketConfig extends MnLifeCycleHooksToStream {
  static get annotations() { return [
    new Component({
      selector: "mn-columnar-bucket-config",
      template,
      inputs: [
        "group",
      ],
      changeDetection: ChangeDetectionStrategy.OnPush
    })
  ]}

  static get parameters() { return [
    MnWizardService,
  ]}

  constructor(mnWizardService) {
    super();
    this.focusFieldSubject = new BehaviorSubject(true);
    this.postNodeInitHttp = mnWizardService.stream.postNodeInitHttp;
    this.postClusterInitHttp = mnWizardService.stream.postClusterInitHttp;
  }

  ngOnInit() {
    this.group.get("bucketStorageScheme").setValue('s3');
  }
}
