/*
Copyright 2020-Present Couchbase, Inc.

Use of this software is governed by the Business Source License included in
the file licenses/BSL-Couchbase.txt.  As of the Change Date specified in that
file, in accordance with the Business Source License, use of this software will
be governed by the Apache License, Version 2.0, included in the file
licenses/APL2.txt.
*/

import {Component, ChangeDetectionStrategy} from '/ui/web_modules/@angular/core.js';
import {merge, pipe} from '/ui/web_modules/rxjs.js';
import {map, filter, pluck, startWith, withLatestFrom, takeUntil, tap} from '/ui/web_modules/rxjs/operators.js';

import {MnLifeCycleHooksToStream} from "./mn.core.js";
import {MnXDCRService} from "./mn.xdcr.service.js";
import {MnFormService} from "./mn.form.service.js";
import {MnCollectionsService} from "./mn.collections.service.js";

export {MnXDCRFilterComponent};

class MnXDCRFilterComponent extends MnLifeCycleHooksToStream {
  static get annotations() { return [
    new Component({
      selector: "mn-xdcr-filter",
      templateUrl: "/ui/app/mn.xdcr.filter.html",
      changeDetection: ChangeDetectionStrategy.OnPush,
      inputs: [
        "bucket",
        "group",
        "xdcrGroup",
        "isEditMode",
        "settingsPipe"
      ]
    })
  ]}

  static get parameters() { return [
    MnXDCRService,
    MnFormService,
    MnCollectionsService
  ]}

  constructor(mnXDCRService, mnFormService, mnCollectionsService) {
    super();

    this.form = mnFormService.create(this);

    this.formHelper =
      mnFormService.create(this)
      .setFormGroup({enableFilters: false});

    this.postRegexpValidation =
      mnXDCRService.stream.postRegexpValidation;
    this.postSettingsReplicationsValidation =
      mnXDCRService.stream.postSettingsReplicationsValidation;
    this.postCreateReplication =
      mnXDCRService.stream.postCreateReplication;
    this.postSettingsReplications =
      mnXDCRService.stream.postSettingsReplications;

    this.mnCollectionsService = mnCollectionsService;

    this.errors = merge(
      this.postRegexpValidation.success,
      this.postRegexpValidation.error,
      this.postCreateReplication.error,
      this.postSettingsReplications.error,
      this.postSettingsReplicationsValidation.error
    ).pipe(map(errors => {
      return errors &&
        (errors.error ? errors.error._ ? errors.error._ :
         errors.error : errors.filterExpression);
    }));

  }

  ngOnInit() {
    this.mnCollectionSelectorService =
      this.mnCollectionsService.createCollectionSelector({
        component: this,
        steps: ["bucket", "scope", "collection"]
      });

    let validateOnStream =
        merge(this.group.valueChanges,
              this.mnCollectionSelectorService.stream.step.pipe(filter(v => v == "ok")));

    this.form
      .setFormGroup(this.group)
      .setPackPipe(pipe(withLatestFrom(this.mnCollectionSelectorService.stream.result),
                        filter(([_, r]) => r.bucket && r.scope && r.collection),
                        map(this.pack.bind(this))))
      .setSourceShared(this.settingsPipe)
      .setPostRequest(this.postRegexpValidation)
      .setValidation(this.postRegexpValidation, null, validateOnStream)
      .trackSubmit()
      .clearErrors();

    this.formHelper.group.patchValue({
      enableFilters: !!this.group.get("filterExpression").value
    });

    let hasSourceBucketField = this.xdcrGroup.get("fromBucket");
    if (hasSourceBucketField) {
      hasSourceBucketField.valueChanges
        .pipe(startWith(hasSourceBucketField.value),
              takeUntil(this.mnOnDestroy))
        .subscribe(v => {
          let action = v ? "enable" : "disable";
          this.formHelper.group.get("enableFilters")[action]({onlySelf: true});
        });
    }
  }

  pack([_, result]) {
    return {
      expression: this.group.get("filterExpression").value,
      docId: this.group.get("docId").value,
      bucket: result.bucket.name,
      scope: result.scope.name,
      collection: result.collection.name
    };
  }
}
