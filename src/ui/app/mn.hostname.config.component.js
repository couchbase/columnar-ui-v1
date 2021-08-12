/*
Copyright 2020-Present Couchbase, Inc.

Use of this software is governed by the Business Source License included in
the file licenses/BSL-Couchbase.txt.  As of the Change Date specified in that
file, in accordance with the Business Source License, use of this software will
be governed by the Apache License, Version 2.0, included in the file
licenses/APL2.txt.
*/

import {Component, ChangeDetectionStrategy} from '../web_modules/@angular/core.js';
import {MnPoolsService} from './mn.pools.service.js';
import {MnWizardService} from './mn.wizard.service.js';
import {BehaviorSubject} from '../web_modules/rxjs.js';
import {takeUntil, pluck, distinctUntilChanged} from '../web_modules/rxjs/operators.js';
import {MnLifeCycleHooksToStream} from './mn.core.js';

export {MnHostnameConfigComponent};

class MnHostnameConfigComponent extends MnLifeCycleHooksToStream {
  static get annotations() { return [
    new Component({
      selector: "mn-hostname-config",
      templateUrl: "app/mn.hostname.config.html",
      inputs: [
        "group",
        "isHostCfgEnabled"
      ],
      changeDetection: ChangeDetectionStrategy.OnPush
    })
  ]}

  static get parameters() { return [
    MnWizardService,
    MnPoolsService
  ]}

  constructor(mnWizardService, mnPoolsService) {
    super();
    this.focusFieldSubject = new BehaviorSubject(true);
    this.postNodeInitHttp = mnWizardService.stream.postNodeInitHttp;
    this.setupNetConfigHttp = mnWizardService.stream.setupNetConfigHttp;
    this.enableExternalListenerHttp = mnWizardService.stream.enableExternalListenerHttp;
    this.isEnterprise = mnPoolsService.stream.isEnterprise;
  }

  ngOnInit() {
    if (!this.isHostCfgEnabled) {
      return;
    }
    this.group.valueChanges
      .pipe(pluck("hostConfig", "addressFamilyUI"),
            distinctUntilChanged(),
            takeUntil(this.mnOnDestroy))
      .subscribe(option => {
        let hostname = this.group.get("hostname").value;

        if ((option == "inet6" || option == "inet6Only") && hostname == "127.0.0.1") {
          this.group.get("hostname").setValue("::1");
        }
        if ((option == "inet" || option == "inetOnly") && hostname == "::1") {
          this.group.get("hostname").setValue("127.0.0.1");
        }
      });
  }
}
