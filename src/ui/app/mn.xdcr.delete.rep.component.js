/*
Copyright 2020-Present Couchbase, Inc.

Use of this software is governed by the Business Source License included in
the file licenses/BSL-Couchbase.txt.  As of the Change Date specified in that
file, in accordance with the Business Source License, use of this software will
be governed by the Apache License, Version 2.0, included in the file
licenses/APL2.txt.
*/

import {Component, ChangeDetectionStrategy} from '@angular/core';
import {NgbActiveModal} from '@ng-bootstrap/ng-bootstrap';
import {map} from 'rxjs/operators';

import {$rootScope} from './ajs.upgraded.providers.js';
import {MnLifeCycleHooksToStream} from './mn.core.js';
import {MnXDCRService} from "./mn.xdcr.service.js";
import {MnFormService} from "./mn.form.service.js";

export {MnXDCRDeleteRepComponent};

class MnXDCRDeleteRepComponent extends MnLifeCycleHooksToStream {
  static get annotations() { return [
    new Component({
      templateUrl: "app/mn.xdcr.delete.rep.html",
      changeDetection: ChangeDetectionStrategy.OnPush,
      inputs: [
        "item"
      ]
    })
  ]}

  static get parameters() { return [
    NgbActiveModal,
    MnXDCRService,
    MnFormService,
    $rootScope
  ]}

  constructor(activeModal, mnXDCRService, mnFormService, $rootScope) {
    super();

    this.form = mnFormService.create(this)
      .setPackPipe(map(() => this.item.id))
      .setPostRequest(mnXDCRService.stream.deleteCancelXDCR)
      .successMessage("Replication deleted successfully!")
      .showGlobalSpinner()
      .success(function () {
        activeModal.close();
        $rootScope.$broadcast("reloadTasksPoller");
      });

    this.activeModal = activeModal;
  }
}
