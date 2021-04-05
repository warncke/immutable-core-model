# v5.1.0

Add [ajv-errors](https://www.npmjs.com/package/ajv-errors) to replace
custom error message functionality that was previously a part of ajv.

# v5.0.0

Upgrade supporting packages to support Node 14. Fix breaking changes
caused by package upgrades.

## Major Version Upgrades

* ajv 8
* mysql2 2
* elasticsearch 16 (dev)
* redis 3 (dev)

# v4.0.0

Version 4.0.0 of Immutable Core Model switches to using
[mysql2](https://www.npmjs.com/package/mysql2) instead of
[immutable-database-mariasql](https://www.npmjs.com/package/immutable-database-mariasql)
as a database driver. This change requires updating many modules that depend
on Immutable Core Model as well as upating Immutable App app.js files.

mysql2 has a number of differences from mariasql that may break code
that interacts with raw database response data including:

* c and d columns are returned as integers instead of strings
* response from create/update commands is object instead of array.info

# v3.3.0

[Immutable Core](https://www.npmjs.com/package/immutable-core) introduced
breaking changes that require Immutable Core Model v3.3.0 or greater.

As of Immutable Core Model v3.3.0 the `accessControl` property for
ImmutableModel is deprecated and the global ImmutableAccessControl instance
will always be used.

# v3.0.0

Version 3.0.0 of Immutable Core Model is a major release with significant
new features and a few major breaking changes.

## Breaking changes

* support for actions eliminated
* support for `select` of custom columns eliminated
* support for using column names in where queries (e.g. fooId) eliminated
* changed class name ImmutableCoreModelInstance to ImmutableCoreModelRecord
* changed record unDelete method name to undelete

## New features

* caching of records, queries, and views
* resolve option to load related records referenced in record data
* n column auto increment primary key to track inserts and order
* select interface exposes then function that executes query
* c column to indicate if record is compressed
* d column to indicate if record is deleted
* int (64bit) and smallint (16bit) types
