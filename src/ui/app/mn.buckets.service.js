import {Injectable} from "/ui/web_modules/@angular/core.js";
import {pluck,
        switchMap,
        shareReplay,
        distinctUntilChanged,
        map} from "/ui/web_modules/rxjs/operators.js";
import {filter, anyPass, propEq} from "/ui/web_modules/ramda.js";
import {HttpClient, HttpParams} from '/ui/web_modules/@angular/common/http.js';
import {MnAdminService} from './mn.admin.service.js';

export {MnBucketsService};

class MnBucketsService {
  static get annotations() { return [
    new Injectable()
  ]}

  static get parameters() { return [
    HttpClient,
    MnAdminService
  ]}

  constructor(http, mnAdminService) {
    this.stream = {};
    this.http = http;

    var bucketsUri =
        mnAdminService.stream.getPoolsDefault.pipe(pluck("buckets", "uri"),
                                                   distinctUntilChanged());
    this.stream.getBuckets =
      bucketsUri.pipe(switchMap(this.get.bind(this)),
                      shareReplay({refCount: true, bufferSize: 1}));

    this.stream.getBucketsByName =
      this.stream.getBuckets.pipe(map(buckets =>
                                      buckets.reduce((acc, bucket) => {
                                        acc[bucket.name] = bucket;
                                        return acc;
                                      }, {})),
                                  shareReplay({refCount: true, bufferSize: 1}));

    this.stream.bucketsMembaseEphemeral =
      this.stream.getBuckets.pipe(map(filter(anyPass([
        propEq('bucketType', 'membase'),
        propEq('bucketType', 'ephemeral')
      ]))), shareReplay({refCount: true, bufferSize: 1}));
  }

  get(url) {
    return this.http.get(url, {params: new HttpParams().set("skipMap", true)});
  }
}
