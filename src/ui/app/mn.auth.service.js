/*
Copyright 2020-Present Couchbase, Inc.

Use of this software is governed by the Business Source License included in
the file licenses/BSL-Couchbase.txt.  As of the Change Date specified in that
file, in accordance with the Business Source License, use of this software will
be governed by the Apache License, Version 2.0, included in the file
licenses/APL2.txt.
*/

import {Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {map} from 'rxjs/operators';
import {BehaviorSubject} from 'rxjs';
import {shareReplay, switchMap} from 'rxjs/operators';
import {singletonGuard} from './mn.core.js';
import {MnHttpRequest} from './mn.http.request.js';

export {MnAuthService}

class MnAuthService {
  static get annotations() { return [
    new Injectable()
  ]}

  static get parameters() { return [
    HttpClient
  ]}

  constructor(http) {
    singletonGuard(MnAuthService);
    this.http = http;
    this.stream = {};

    this.stream.postUILogin =
      new MnHttpRequest(this.postUILogin.bind(this))
      .addSuccess()
      .addError(map(rv => rv.status));

    this.stream.getAuthMethods =
      (new BehaviorSubject()).pipe(
        switchMap(this.getAuthMethods.bind(this)),
        shareReplay({refCount: true, bufferSize: 1}));

    // this.stream.postUILogout =
    //   new mn.core.MnPostHttp(this.postUILogout.bind(this));
  }

  whoami() {
    return this.http.get('/whoami');
  }

  postUILogin(user) {
    return this.http.post('/uilogin', user || {});
    // should be moved into app.admin alerts
    // we should say something like you are using cached vesrion, reload the tab
    // return that.mnPoolsService
    //   .get$
    //   .map(function (cachedPools, newPools) {

    // if (cachedPools.implementationVersion !== newPools.implementationVersion) {
    //   return {ok: false, status: 410};
    // } else {
    //   return resp;
    // }
    // });
  }

  postUILogout() {
    return this.http.post("/uilogout");
    // .then(function () {
    //     $window.location.reload();
    //   }, function () {
    //     $window.location.reload();
    //   });
  }

  getAuthMethods() {
    return this.http.get("/_ui/authMethods");
  }
}
