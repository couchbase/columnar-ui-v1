import { Subject, of, merge, NEVER, zip } from '../web_modules/rxjs.js';
import { HttpErrorResponse } from '../web_modules/@angular/common/http.js';
import { catchError, switchMap, shareReplay, mapTo, filter, map,
         tap } from '../web_modules/rxjs/operators.js';
import { MnHelperService } from './mn.helper.service.js';

export { MnHttpRequest, MnHttpGroupRequest };

class MnHttpGroupRequest {
  constructor(httpMap) {
    this.request = new Subject();
    this.httpMap = httpMap;
    this.fakeMap = Object.keys(this.httpMap).reduce((acc, name) => {
      acc[name] = new Subject();
      return acc;
    }, {});
  }

  clearError() {
    Object.keys(this.httpMap).forEach((key) => this.httpMap[key].clearError());
  }

  addError() {
    this.error =
      zip.apply(null, this.getHttpGroupStreams.bind(this)("response"))
      .pipe(filter((responses) =>
                   responses.find((resp) =>
                                  resp instanceof HttpErrorResponse)))
    return this;
  }

  addSuccess() {
    this.success =
      zip.apply(null, this.getHttpGroupStreams.bind(this)("response"))
      .pipe(filter((responses) =>
                   !responses.find((resp) =>
                                   resp instanceof HttpErrorResponse)));
    return this;
  }

  doOrderedRequest(data) {
    Object.keys(this.httpMap).forEach((key) => {
      if (!data.get(key)) {
        data.set(key, null);
      }
    });
    Array.from(data.keys()).forEach((key) => {
      if (data.get(key) === null) {
        this.fakeMap[key].next(null);
      } else {
        this.httpMap[key].post(data.get(key));
      }
    });
  }

  post(data) {
    data = data || {};
    this.request.next();
    if (data instanceof Map) {
      this.doOrderedRequest(data);
    } else {
      Object.keys(this.httpMap).forEach((key) => this.httpMap[key].post(data[key]));
    }
  }

  getHttpGroupStreams(stream) {
    return Object.keys(this.httpMap).reduce((result, key) => {
      result.push(merge(this.httpMap[key][stream], this.fakeMap[key]));
      return result;
    }, []);
  }

  addLoading() {
    this.loading =
      merge(
        zip.apply(null, this.getHttpGroupStreams.bind(this)("response")).pipe(mapTo(false)),
        this.request.pipe(mapTo(true)));
    return this;
  }
}

class MnHttpRequest {
  constructor(call) {
    this._dataSubject = new Subject();
    this._errorSubject = new Subject();
    this._loadingSubject = new Subject();
    this.addResponse(call);
  }

  clearError() {
    this._errorSubject.next(null);
  }

  addResponse(call) {
    let errorsAndSuccess = switchMap((data) => call(data).pipe(catchError((err) => of(err))));
    this.response = this._dataSubject.pipe(errorsAndSuccess,
                                           shareReplay({refCount: true, bufferSize: 1}));
    return this;
  }

  addError(modify) {
    let extractErrorsPipe =
        switchMap((rv) => {
          if (rv instanceof HttpErrorResponse) {
            return of(rv);
          } else if (MnHelperService.prototype.isJson(rv) && rv.includes("errors")) {
            return of(new HttpErrorResponse({error: rv}));
          } else {
            return NEVER;
          }
        });

    var error = merge(
      this._errorSubject,
      this.response.pipe(
        extractErrorsPipe,
        map(function (rv) {
          if (!!rv.error && MnHelperService.prototype.isJson(rv.error)) {
            return JSON.parse(rv.error);
          } else {
            return rv;
          }
        }),
        (modify ? modify : tap()),
        shareReplay({refCount: true, bufferSize: 1})));

    this.error = error;
    return this;
  }

  addLoading() {
    this.loading = merge(this._loadingSubject, this.response.pipe(mapTo(false)));
    return this;
  }

  addSuccess(modify) {
    var success =
        this.response.pipe(
          filter((rv) => !(rv instanceof HttpErrorResponse)),
          shareReplay({refCount: true, bufferSize: 1})
        );
    if (modify) {
      success = success.pipe(modify);
    }
    this.success = success;
    return this;
  }

  post(data) {
    this._loadingSubject.next(true);
    this._dataSubject.next(data);
  }
}
