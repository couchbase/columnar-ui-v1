/*
Copyright 2020-Present Couchbase, Inc.

Use of this software is governed by the Business Source License included in
the file licenses/BSL-Couchbase.txt.  As of the Change Date specified in that
file, in accordance with the Business Source License, use of this software will
be governed by the Apache License, Version 2.0, included in the file
licenses/APL2.txt.
*/

import { Component } from '../web_modules/@angular/core.js';
import { FormGroup, FormControl, Validators } from '../web_modules/@angular/forms.js';
import { BehaviorSubject } from '../web_modules/rxjs.js';
import { MnAuthService } from './mn.auth.service.js';
import { MnFormService } from './mn.form.service.js';
import { UIRouter } from '../web_modules/@uirouter/angular.js';
import { MnLifeCycleHooksToStream } from './mn.core.js';

export { MnAuthComponent };

class MnAuthComponent extends MnLifeCycleHooksToStream {
  static annotations = [
    new Component({
      templateUrl: "app-new/mn.auth.html",
    })
  ]

  static parameters = [
    MnFormService,
    MnAuthService,
    UIRouter
  ]

  constructor(mnFormService, mnAuthService, uiRouter) {
    super();
    this.focusFieldSubject = new BehaviorSubject(true);

    this.postUILogin = mnAuthService.stream.postUILogin;

    this.form = mnFormService.create(this)
      .setFormGroup({
        user: ['', Validators.required],
        password: ['', Validators.required]})
      .setPostRequest(this.postUILogin)
      .success(uiRouter.urlRouter.sync.bind(uiRouter.urlRouter));
  }
}
