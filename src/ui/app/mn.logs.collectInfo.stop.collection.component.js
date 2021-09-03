/*
Copyright 2021-Present Couchbase, Inc.

Use of this software is governed by the Business Source License included in
the file licenses/BSL-Couchbase.txt.  As of the Change Date specified in that
file, in accordance with the Business Source License, use of this software will
be governed by the Apache License, Version 2.0, included in the file
licenses/APL2.txt.
*/

import {ChangeDetectionStrategy, Component} from '/ui/web_modules/@angular/core.js';
import {MnLifeCycleHooksToStream} from './mn.core.js';
import {NgbActiveModal} from '/ui/web_modules/@ng-bootstrap/ng-bootstrap.js';
import {MnFormService} from './mn.form.service.js';
import {MnLogsCollectInfoService} from './mn.logs.collectInfo.service.js';

export { MnLogsCollectInfoStopCollectionComponent };

class MnLogsCollectInfoStopCollectionComponent extends MnLifeCycleHooksToStream {

  static get annotations() { return [
    new Component({
      selector: "mn-logs-collect-info-stop-collection",
      templateUrl: "/ui/app/mn.logs.collectInfo.stop.collection.html",
      changeDetection: ChangeDetectionStrategy.OnPush
    })
  ]}

  static get parameters() { return [
    NgbActiveModal,
    MnFormService,
    MnLogsCollectInfoService
  ]}

  constructor(activeModal, mnFormService, mnLogsCollectInfoService) {
    super();

    this.activeModal = activeModal;
    this.stopCollection = mnLogsCollectInfoService.stream.postCancelLogsCollection;

    this.form = mnFormService.create(this)
      .setFormGroup({})
      .setPostRequest(this.stopCollection)
      .success(() => this.activeModal.dismiss());
  }
}
