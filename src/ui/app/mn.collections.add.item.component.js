import {Component, ChangeDetectionStrategy} from '/ui/web_modules/@angular/core.js';
import {NgbActiveModal} from '/ui/web_modules/@ng-bootstrap/ng-bootstrap.js';
import {MnLifeCycleHooksToStream} from './mn.core.js';
import {withLatestFrom, map} from '/ui/web_modules/rxjs/operators.js';
import {pipe} from '/ui/web_modules/rxjs.js';

import {MnFormService} from "./mn.form.service.js";
import {MnCollectionsService} from './mn.collections.service.js';
import {MnPoolsService} from './mn.pools.service.js';

export {MnCollectionsAddItemComponent}

class MnCollectionsAddItemComponent extends MnLifeCycleHooksToStream {
  static get annotations() { return [
    new Component({
      templateUrl: "app/mn.collections.add.item.html",
      changeDetection: ChangeDetectionStrategy.OnPush
    })
  ]}

  static get parameters() { return [
    NgbActiveModal,
    MnCollectionsService,
    MnFormService,
    MnPoolsService
  ]}

  constructor(activeModal, mnCollectionsService, mnFormService, mnPoolsService) {
    super();
    this.activeModal = activeModal;
    this.form = mnFormService.create(this);
    this.addCollectionHttp = mnCollectionsService.stream.addCollectionHttp;
    this.isEnterprise = mnPoolsService.stream.isEnterprise;

    this.form
      .setFormGroup({name: "", maxTTL: 0})
      .setPackPipe(pipe(
        withLatestFrom(this.isEnterprise),
        map(this.prepareDataForSending.bind(this))))
      .setPostRequest(this.addCollectionHttp)
      .showGlobalSpinner()
      .success(() => {
        mnCollectionsService.stream.updateManifest.next();
        activeModal.close()
      });
  }

  prepareDataForSending([_, isEnterprise]) {
    let dataForSending = [this.bucketName, this.scopeName, this.form.group.value.name];
    if (isEnterprise) {
      dataForSending.push(this.form.group.value.maxTTL);
    }

    return dataForSending;
  }
}
