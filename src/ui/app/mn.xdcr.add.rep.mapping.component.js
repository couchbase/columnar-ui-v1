/*
Copyright 2020-Present Couchbase, Inc.

Use of this software is governed by the Business Source License included in
the file licenses/BSL-Couchbase.txt.  As of the Change Date specified in that
file, in accordance with the Business Source License, use of this software will
be governed by the Apache License, Version 2.0, included in the file
licenses/APL2.txt.
*/

import {Component, ChangeDetectionStrategy} from '/ui/web_modules/@angular/core.js';
import {Subject, of} from '/ui/web_modules/rxjs.js';
import {map, filter, switchMap, shareReplay, takeUntil, startWith,
        distinctUntilChanged} from '/ui/web_modules/rxjs/operators.js';

import {MnLifeCycleHooksToStream} from "./mn.core.js";

import {MnPoolsService} from "./mn.pools.service.js";
import {MnXDCRService} from "./mn.xdcr.service.js";
import {MnCollectionsService} from './mn.collections.service.js';
import {MnHelperService} from "./mn.helper.service.js";

export {MnXDCRAddRepMappingComponent};

class MnXDCRAddRepMappingComponent extends MnLifeCycleHooksToStream {
  static get annotations() { return [
    new Component({
      selector: "mn-xdcr-mapping",
      templateUrl: "/ui/app/mn.xdcr.add.rep.mapping.html",
      changeDetection: ChangeDetectionStrategy.OnPush,
      inputs: [
        "explicitMappingRules",
        "explicitMappingMigrationRules",
        "explicitMappingGroup",
        "group",
        "bucket"
      ]
    })
  ]}

  static get parameters() { return [
    MnPoolsService,
    MnXDCRService,
    MnHelperService,
    MnCollectionsService
  ]}

  constructor(mnPoolsService, mnXDCRService, mnHelperService, mnCollectionsService) {
    super();

    this.mnCollectionsService = mnCollectionsService;
    this.mnHelperService = mnHelperService;
    this.isEnterprise = mnPoolsService.stream.isEnterprise;
    this.postCreateReplication = mnXDCRService.stream.postCreateReplication;
    this.postSettingsReplicationsValidation =
      mnXDCRService.stream.postSettingsReplicationsValidation;
    this.postSettingsReplications =
      mnXDCRService.stream.postSettingsReplications;

    this.addExplicitMappingMigrationRules = new Subject();

    this.addExplicitMappingMigrationRules
      .pipe(takeUntil(this.mnOnDestroy))
      .subscribe(v => {
        let newRule = this.explicitMappingGroup.migrationMode.value;
        let rules = this.explicitMappingMigrationRules.getValue();
        rules[newRule.key || "_default._default"] = newRule.target;
        this.explicitMappingMigrationRules.next(rules);
        resetExplicitMappingMigrationGroup.bind(this)();
      });

    function resetExplicitMappingMigrationGroup() {
      this.explicitMappingGroup.migrationMode.patchValue({key: "", target: ""});
    }
  }

  ngOnInit() {

    this.group.get("collectionsExplicitMapping").valueChanges
      .pipe(takeUntil(this.mnOnDestroy))
      .subscribe(enabled => {
        if (enabled) {
          this.group.get("collectionsMigrationMode").patchValue(false, {onlySelf: true});
        }
      });

    this.group.get("collectionsMigrationMode").valueChanges
      .pipe(takeUntil(this.mnOnDestroy))
      .subscribe(enabled => {
        if (enabled) {
          this.group.get("collectionsExplicitMapping").patchValue(false, {onlySelf: true});
        }
      });

    let hasSourceBucketField = this.group.get("fromBucket");
    if (hasSourceBucketField) {
      hasSourceBucketField.valueChanges
        .pipe(startWith(hasSourceBucketField.value),
              takeUntil(this.mnOnDestroy))
        .subscribe(v => {
          let action = v ? "enable" : "disable";
          this.group.get("collectionsExplicitMapping")[action]({onlySelf: true});
          this.group.get("collectionsMigrationMode")[action]({onlySelf: true});
        });
    }

    this.scopes =
      (this.bucket ? of(this.bucket) : this.group.get("fromBucket").valueChanges)
      .pipe(filter(v => !!v),
            distinctUntilChanged(),
            switchMap(bucketName => this.mnCollectionsService.getManifest(bucketName)),
            map(v => [v.scopes]),
            shareReplay({refCount: true, bufferSize: 1}));
  }
}
