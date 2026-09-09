/*
Copyright 2026-Present Couchbase, Inc.

Use of this software is governed by the Business Source License included in
the file licenses/BSL-Couchbase.txt.  As of the Change Date specified in that
file, in accordance with the Business Source License, use of this software will
be governed by the Apache License, Version 2.0, included in the file
licenses/APL2.txt.
*/

// What the catalog and Iceberg-collection dialogs do, judged by the statement
// the workbench would have sent. A dialog's job is to turn a handful of form
// fields into DDL, and every mistake that matters shows up in that string.

import {makeEnv} from "./env.js";
import {ok, equal, contains, omits} from "./assert.js";

const REGIONS = ["us-east-1", "us-east-2", "eu-west-1"];

// A catalog dialog, opened and ready to fill in. Vending is off by default,
// exactly as it ships.
function catalogDialog(options) {
  options = options || {};
  const env = makeEnv();
  // Only ever turned on: a test that asserts the option is hidden has to be
  // reading the value this UI ships with, not one the helper just wrote.
  if (options.vendingEnabled) {
    env.cwConstantsService.icebergVendingEnabled = true;
  }
  env.cwQueryService.awsRegions = REGIONS.slice();
  env.cwQueryService.links = options.links || [];
  env.controller.createNewCatalog();
  env.scope = env.modal.scope();
  env.digest();
  env.scope.options.catalog_name = "cat";
  env.scope.options.catalog_source = options.source || "REST";
  env.scope.options.catalog_link = options.link || "";
  env.digest();
  return env;
}

// An Iceberg collection dialog on `catalog`, with `catalogs` in the metadata.
function icebergDialog(options) {
  options = options || {};
  const env = makeEnv();
  if (options.vendingEnabled) {
    env.cwConstantsService.icebergVendingEnabled = true;
  }
  env.cwQueryService.databases.push({DatabaseName: "db"});
  env.cwQueryService.dataverses.push({DatabaseName: "db", DataverseName: "scope"});
  (options.catalogs || [{CatalogName: "cat", VendedCredentials: true}])
    .forEach(catalog => env.cwQueryService.catalogs.push(catalog));
  env.controller.createNewIcebergCollection(env.cwQueryService.catalogs[0]);
  env.scope = env.modal.scope();
  env.digest();
  env.scope.options.collection_name = "coll";
  env.scope.options.selectedLink = "link1";
  env.scope.options.namespace = "ns";
  // Choosing a namespace reloads the table list and clears the chosen table,
  // so the table has to be picked after that has settled - as a user would.
  env.digest();
  env.scope.options.tableName = "tbl";
  return env;
}

export default [

  // ----------------------------------------------------------------- catalog

  ['a catalog is created with the properties the dialog collected', function () {
    const env = catalogDialog();
    env.scope.options.catalog_params.uri = "https://iceberg.example";
    env.scope.options.catalog_params.sigv4SigningRegion = "us-east-2";
    env.scope.submitCatalog();
    env.digest();
    const sql = env.lastStatement();
    contains(sql, 'CREATE CATALOG `cat` TYPE Iceberg SOURCE REST');
    contains(sql, '"uri": "https://iceberg.example"');
    contains(sql, '"sigv4SigningRegion": "us-east-2"');
  }],

  ['the "Other" signing region is replaced by the one typed beside it', function () {
    const env = catalogDialog();
    env.scope.options.catalog_params.sigv4SigningRegion = "Other";
    env.scope.options.other_sigv4_region = "us-gov-west-1";
    env.scope.submitCatalog();
    env.digest();
    const sql = env.lastStatement();
    contains(sql, '"sigv4SigningRegion": "us-gov-west-1"');
    omits(sql, '"Other"', 'the escape-hatch marker must not reach the server');
  }],

  ['the signing region is preselected from the chosen link', function () {
    const env = catalogDialog({links: [{name: "l1", region: "us-east-2"}]});
    env.scope.options.catalog_link = "l1";
    env.digest();
    equal(env.scope.options.catalog_params.sigv4SigningRegion, "us-east-2");
    equal(env.scope.options.other_sigv4_region, "");
  }],

  ['a link region outside the list is kept through "Other"', function () {
    const env = catalogDialog({links: [{name: "l1", region: "us-iso-east-1"}]});
    env.scope.options.catalog_link = "l1";
    env.digest();
    equal(env.scope.options.catalog_params.sigv4SigningRegion, "Other");
    equal(env.scope.options.other_sigv4_region, "us-iso-east-1");
    env.scope.submitCatalog();
    env.digest();
    contains(env.lastStatement(), '"sigv4SigningRegion": "us-iso-east-1"');
  }],

  ['a link with no region leaves nothing behind from the last one', function () {
    const env = catalogDialog({links: [{name: "s3", region: "us-east-2"},
                                       {name: "nessie"}]});
    env.scope.options.catalog_link = "s3";
    env.digest();
    env.scope.options.catalog_link = "nessie";
    env.digest();
    equal(env.scope.options.catalog_params.sigv4SigningRegion, "");
    equal(env.scope.options.other_sigv4_region, "");
  }],

  ['the catalog vending option is hidden while the feature is off', function () {
    const env = catalogDialog({source: "REST"});
    equal(env.cwConstantsService.icebergVendingEnabled, false,
          'the flag ships off; a change here is a product decision, not a test fix');
    equal(env.scope.sourceCanVendCredentials(), false);
  }],

  ['the catalog vending option is offered only for a source that can vend', function () {
    const env = catalogDialog({vendingEnabled: true, source: "REST"});
    equal(env.scope.sourceCanVendCredentials(), true, 'REST');
    env.cwConstantsService.vendedCredentialsCatalogSources.forEach(function (source) {
      env.scope.options.catalog_source = source;
      env.digest();
      equal(env.scope.sourceCanVendCredentials(), true, source);
    });
    ["HIVE", "AWS_GLUE", "HADOOP"].forEach(function (source) {
      env.scope.options.catalog_source = source;
      env.digest();
      equal(env.scope.sourceCanVendCredentials(), false, source);
    });
  }],

  ['choosing a source that cannot vend turns vending off', function () {
    const env = catalogDialog({vendingEnabled: true, source: "REST"});
    env.scope.options.vendedCredentials = true;
    env.digest();
    env.scope.options.catalog_source = "HIVE";
    env.digest();
    equal(env.scope.options.vendedCredentials, false,
          'a hidden checkbox must not go on vending');
    env.scope.submitCatalog();
    env.digest();
    omits(env.lastStatement(), 'vendedCredentials');
  }],

  ['a vending catalog says so in its DDL, and a plain one says nothing', function () {
    const vending = catalogDialog({vendingEnabled: true, source: "REST"});
    vending.scope.options.vendedCredentials = true;
    vending.digest();
    vending.scope.submitCatalog();
    vending.digest();
    contains(vending.lastStatement(), '"vendedCredentials": "true"');

    const plain = catalogDialog({vendingEnabled: true, source: "REST"});
    plain.scope.submitCatalog();
    plain.digest();
    omits(plain.lastStatement(), 'vendedCredentials',
          'an absent property is what tells the server "not vending"');
  }],

  ['the signing name defaults to a value the select actually offers', function () {
    const env = catalogDialog({source: "S3_TABLES"});
    equal(env.scope.options.catalog_params.sigv4SigningName, "glue");
    env.scope.options.catalog_params.sigv4SigningName = "s3tables";
    env.scope.options.catalog_source = "AWS_GLUE_REST";
    env.digest();
    equal(env.scope.options.catalog_params.sigv4SigningName, "glue",
          'only S3_TABLES offers s3tables; carrying it over blanks the select');
  }],

  // ------------------------------------------------------- iceberg collection

  ['a collection is created AT the chosen link', function () {
    const env = icebergDialog();
    env.modal.ok();
    const sql = env.lastStatement();
    contains(sql, 'CREATE EXTERNAL COLLECTION `db`.`scope`.`coll`');
    contains(sql, 'ON `cat`');
    contains(sql, 'AT `link1`');
  }],

  ['a vending collection is created without a link', function () {
    const env = icebergDialog({vendingEnabled: true});
    env.scope.options.vendedCredentials = true;
    env.digest();
    env.modal.ok();
    const sql = env.lastStatement();
    contains(sql, 'ON `cat`');
    omits(sql, ' AT ', 'omitting AT is what tells the server to use the catalog credentials');
  }],

  ['the collection vending option is hidden while the feature is off', function () {
    const env = icebergDialog({catalogs: [{CatalogName: "cat", VendedCredentials: true}]});
    equal(env.cwConstantsService.icebergVendingEnabled, false,
          'the flag ships off; a change here is a product decision, not a test fix');
    equal(env.scope.catalogVendsCredentials(), false);
  }],

  ['the collection vending option is offered only for a catalog that vends', function () {
    const env = icebergDialog({
      vendingEnabled: true,
      catalogs: [{CatalogName: "vends", VendedCredentials: true},
                 {CatalogName: "plain", VendedCredentials: false}]
    });
    equal(env.scope.catalogVendsCredentials(), true, 'vends');
    env.scope.options.selectedCatalog = "plain";
    env.digest();
    equal(env.scope.catalogVendsCredentials(), false, 'plain');
  }],

  ['switching to a catalog that does not vend restores the link', function () {
    const env = icebergDialog({
      vendingEnabled: true,
      catalogs: [{CatalogName: "vends", VendedCredentials: true},
                 {CatalogName: "plain", VendedCredentials: false}]
    });
    env.scope.options.vendedCredentials = true;
    env.digest();
    env.scope.options.selectedCatalog = "plain";
    env.digest();
    equal(env.scope.options.vendedCredentials, false);
    env.modal.ok();
    contains(env.lastStatement(), 'AT `link1`',
             'without the link the server would reject the statement');
  }],

  // ------------------------------------------------------------ the markup

  ['the catalog dialog shows the vending checkbox exactly when it applies', function () {
    const off = catalogDialog({source: "REST"});
    equal(off.render().querySelector('#catalog_vended_credentials'), null,
          'the feature is off, so the checkbox must not be in the markup');

    const on = catalogDialog({vendingEnabled: true, source: "REST"});
    const checkbox = on.render().querySelector('#catalog_vended_credentials');
    ok(checkbox, 'a REST catalog offers vending');

    on.scope.options.catalog_source = "HIVE";
    on.digest();
    equal(on.render().querySelector('#catalog_vended_credentials'), null,
          'HIVE cannot vend');
  }],

  ['every source that may vend is one the dialog can select', function () {
    const env = catalogDialog({vendingEnabled: true});
    const offered = Array.from(env.render().querySelectorAll('#catalog_source option'))
      .map(option => option.value);
    env.cwConstantsService.vendedCredentialsCatalogSources.forEach(function (source) {
      ok(offered.indexOf(source) >= 0,
         source + ' can vend but is not one of the sources the dialog offers: ' +
         offered.filter(Boolean).join(', '));
    });
  }],

  ['ticking the box in the catalog dialog reaches the statement', function () {
    const env = catalogDialog({vendingEnabled: true, source: "REST"});
    const checkbox = env.render().querySelector('#catalog_vended_credentials');
    checkbox.click();
    env.digest();
    equal(env.scope.options.vendedCredentials, true, 'the checkbox drives the model');
    env.scope.submitCatalog();
    env.digest();
    contains(env.lastStatement(), '"vendedCredentials": "true"');
  }],

  ['the collection dialog shows the vending checkbox exactly when it applies', function () {
    const catalogs = [{CatalogName: "vends", VendedCredentials: true},
                      {CatalogName: "plain", VendedCredentials: false}];

    const off = icebergDialog({catalogs: catalogs});
    equal(off.render().querySelector('#iceberg_vended_credentials'), null,
          'the feature is off, so the checkbox must not be in the markup');

    const on = icebergDialog({vendingEnabled: true, catalogs: catalogs});
    ok(on.render().querySelector('#iceberg_vended_credentials'), 'a vending catalog');

    on.scope.options.selectedCatalog = "plain";
    on.digest();
    equal(on.render().querySelector('#iceberg_vended_credentials'), null,
          'a catalog that does not vend');
  }],

  ['the link stops being asked for once the collection vends', function () {
    const env = icebergDialog({vendingEnabled: true});
    const root = env.render();
    const link = root.querySelector('#iceberg_link');
    ok(link, 'the link select');
    equal(link.disabled, false);
    equal(link.required, true, 'a collection with no vending needs a link');

    root.querySelector('#iceberg_vended_credentials').click();
    env.digest();
    equal(link.disabled, true, 'the link is not used when the catalog vends');
    equal(link.required, false, 'and an empty one must not block the form');
  }],

  // ------------------------------------------------------ catalog metadata

  ['a catalog knows whether it vends, whatever the metadata says', function () {
    const env = makeEnv();
    const statements = [];
    env.onHttp(function (config) {
      const statement = config.data && config.data.statement;
      if (!statement) {
        return undefined;
      }
      statements.push(statement);
      return env.$q.resolve({data: {results: [
        {isCatalog: true, CatalogName: "on", VendedCredentials: "true"},
        {isCatalog: true, CatalogName: "off", VendedCredentials: "false"},
        // what every catalog created before the feature existed looks like
        {isCatalog: true, CatalogName: "absent"}
      ]}});
    });

    env.cwQueryService.updateBuckets();
    env.digest();

    const catalogs = {};
    env.cwQueryService.catalogs.forEach(c => { catalogs[c.CatalogName] = c.VendedCredentials; });
    equal(catalogs.on, true, '"true"');
    equal(catalogs.off, false, '"false"');
    equal(catalogs.absent, false, 'absent property');

    ok(statements.some(s => s.indexOf('AS VendedCredentials') >= 0),
       'the metadata query must project the property the dialogs read:\n' + statements.join('\n'));
  }],

];
