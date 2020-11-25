import { Injectable } from '/ui/web_modules/@angular/core.js';
import { pluck, distinctUntilChanged, shareReplay, map, switchMap } from '/ui/web_modules/rxjs/operators.js';
import { combineLatest } from "/ui/web_modules/rxjs.js";
import { HttpClient } from '/ui/web_modules/@angular/common/http.js';
import { MnBucketsService } from './mn.buckets.service.js';
import { MnAdminService } from './mn.admin.service.js';

let bucketSpecificPermissions = [function (bucket) {
  var name = bucket.name;
  var basePermissions = [
    "cluster.bucket[" + name + "].settings!write",
    "cluster.bucket[" + name + "].settings!read",
    "cluster.bucket[" + name + "].recovery!write",
    "cluster.bucket[" + name + "].recovery!read",
    "cluster.bucket[" + name + "].stats!read",
    "cluster.bucket[" + name + "]!flush",
    "cluster.bucket[" + name + "]!delete",
    "cluster.bucket[" + name + "]!compact",
    "cluster.bucket[" + name + "].xdcr!read",
    "cluster.bucket[" + name + "].xdcr!write",
    "cluster.bucket[" + name + "].xdcr!execute",
    "cluster.bucket[" + name + "].n1ql.select!execute",
    "cluster.bucket[" + name + "].n1ql.index!read",
    "cluster.bucket[" + name + "].n1ql.index!write",
    "cluster.bucket[" + name + "].collections!read",
    "cluster.bucket[" + name + "].collections!write",
    "cluster.bucket[" + name + "].collections!delete"
  ];
  if (bucket.name === "." || (bucket.bucketType === "membase")) {
    basePermissions = basePermissions.concat([
      "cluster.bucket[" + name + "].views!read",
      "cluster.bucket[" + name + "].views!write",
      "cluster.bucket[" + name + "].views!compact"
    ]);
  }
  if (bucket.name === "." || (bucket.bucketType !== "memcached")) {
    basePermissions = basePermissions.concat([
      "cluster.bucket[" + name + "].data!write",
      "cluster.bucket[" + name + "].data!read",
      "cluster.bucket[" + name + "].data.docs!read",
      "cluster.bucket[" + name + "].data.docs!upsert"
    ]);
  }

  return basePermissions;
}];

let interestingPermissions = ([
  "cluster.buckets!create",
  "cluster.nodes!write",
  "cluster.pools!read",
  "cluster.server_groups!read",
  "cluster.server_groups!write",
  "cluster.settings!read",
  "cluster.settings!write",
  "cluster.stats!read",
  "cluster.tasks!read",
  "cluster.settings.indexes!read",
  "cluster.admin.internal!all",
  "cluster.xdcr.settings!read",
  "cluster.xdcr.settings!write",
  "cluster.xdcr.remote_clusters!read",
  "cluster.xdcr.remote_clusters!write",
  "cluster.admin.security!read",
  "cluster.admin.logs!read",
  "cluster.admin.settings!read",
  "cluster.admin.settings!write",
  "cluster.logs!read",
  "cluster.pools!write",
  "cluster.settings.indexes!write",
  "cluster.admin.security!write",
  "cluster.samples!read",
  "cluster.nodes!read"
]).concat(bucketSpecificPermissions[0]({name: "."}));

export {MnPermissionsService};

class MnPermissionsService {
  static get annotations() { return [
    new Injectable()
  ]}

  static get parameters() { return [
    HttpClient,
    MnBucketsService,
    MnAdminService
  ]}

  constructor(http, mnBucketsService, mnAdminService) {
    this.http = http;
    this.stream = {};

    this.stream.url =
      mnAdminService.stream.getPoolsDefault.pipe(pluck("checkPermissionsURI"),
                                                 distinctUntilChanged());
    var concatAllBucketsPermissions =
        map(rv => rv.reduce((acc, bucket) =>
                            acc.concat(this.generateBucketPermissions(bucket)), []));
    var allBucketsPermissions =
        mnBucketsService.stream.getBuckets.pipe(concatAllBucketsPermissions);

    this.stream.getBucketsPermissions =
      combineLatest(allBucketsPermissions, this.stream.url)
      .pipe(switchMap(this.doGet.bind(this)), shareReplay({refCount: true, bufferSize: 1}));

    this.stream.getSuccess =
      this.stream.url.pipe(map((url) => [this.getAll(), url]),
                           switchMap(this.doGet.bind(this)),
                           shareReplay({refCount: true, bufferSize: 1}));

  }

  generateBucketPermissions(bucketName) {
    return bucketSpecificPermissions.reduce(function (acc, getChunk) {
      return acc.concat(getChunk(bucketName));
    }, []);
  }

  getAll() {
    return [...interestingPermissions];
  }

  set(permission) {
    if (!interestingPermissions.includes(permission)) {
      interestingPermissions.push(permission);
    }
    return this;
  }


  setBucketSpecific(func) {
    if (func instanceof Function) {
      bucketSpecificPermissions.push(func);
    }
    return this;
  }

  doGet(urlAndPermissions) {
    return this.http
      .post(urlAndPermissions[1], urlAndPermissions[0].join(','))
      .pipe(map(rv => JSON.parse(rv)));
  }
}
