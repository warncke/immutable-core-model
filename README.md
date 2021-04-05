# immutable-core-model

Immutable Core Model integrates with the
[Immutable App](https://www.npmjs.com/package/immutable-app) ecosystem and
provides persistence of immutable data objects using MySQL, Redis and
Elasticsearch.

Immutable Core Model requires native async/await support.

## Creating a new database connection

    const mysql = ImmutableCoreModel.createMysqlConnection({
        database: 'database-name',
        host: 'localhost',
        password: 'db-password'
        user: 'db-user'
    })

The connection parameters will have required defaults added and will then
be passed to mysql2 to create a connection.

If the `connectionLimit` param is set then a connection pool will be created
instead of a single connection. This is recommended for production use.

The default connection params are:

    bigNumberStrings: true,
    dateStrings: true,
    namedPlaceholders: true,
    rowsAsArray: false,
    supportBigNumbers: true,

These parameters are needed for Immutable Core Model process results correctly
and so they cannot be changed.

## Creating a new model

    const ImmutableCoreModel = require('immutable-core-model')

    var fooModel = new ImmutableCoreModel({name: 'foo'})

## Syncing model specification to database

    await fooModel.sync()

In a production environment clients should not have database credentials that
allow anything besides INSERT and SELECT on the database.

All models should be sync'd prior to deploying new code with specification
changes that require creating or modifying tables.

## Altering model tables, columns, and indexes

Immutable Core Model only supports limited alterations to existing model
tables:

* Adding new columns
* Adding new indexes to columns without indexes

These operations are currently done as ALTER TABLE statements which may cause
significant performance impacts with large tables in production envrionments.

## Compression

By default Immutable Core Model compresses data records using Google's snappy compression algorithm.

### Disabling compression for an individual model

    new ImmutableCoreModel({compression: false})

### Setting the default compression setting for all models

    ImmutableCoreModel.defaultCompression(false)

### Setting compression from the env

    DEFAULT_COMPRESSION=true node app
    DEFAULT_COMPRESSION=false node app

    DEFAULT_COMPRESSION=1 node app
    DEFAULT_COMPRESSION=0 node app

If the default compression setting is set in the environment this will
override any values set either globally or at the model level in code.

## Id column type

By default Immutable Core Model uses binary columns for ids. This saves space
but makes it more difficult to work with the database using other tools.

### Disabling binaryIds for an individual model

    new ImmutableCoreModel({binaryIds: false})

### Setting the default binaryIds setting for all models

    ImmutableCoreModel.defaultBinaryIds(false)

### Setting id column type from the env

    DEFAULT_BINARY_IDS=true node app
    DEFAULT_BINARY_IDS=false node app

    DEFAULT_BINARY_IDS=1 node app
    DEFAULT_BINARY_IDS=0 node app

If the default binary ids setting is set in the environment this will
override any values set either globally or at the model level in code.

## Schema

For the simple example above the following schema will be created:

    CREATE TABLE foo (
        n bigint(20) unsigned NOT NULL AUTO_INCREMENT,
        c smallint(5) unsigned NOT NULL DEFAULT '1',
        d tinyint(1) NOT NULL DEFAULT '0',
        fooAccountId binary(16) NOT NULL,
        fooCreateTime datetime(6) NOT NULL,
        fooData mediumblob NOT NULL,
        fooId binary(16) NOT NULL,
        fooOriginalId binary(16) NOT NULL,
        fooParentId binary(16) DEFAULT NULL,
        fooSessionId binary(16) NOT NULL,
        PRIMARY KEY (n),
        UNIQUE KEY (fooId),
        UNIQUE KEY (fooParentId),
        KEY (fooAccountId),
        KEY (fooCreateTime),
        KEY (fooOriginalId),
        KEY (fooSessionId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8

All single character column names are reserved for system use and single
character system columns will always come first in the schema.

All model columns are created in alphabetical order after system columns.

As of version 2.0.0 all ids are lower case. Previously they were upper case.

### n

The n column provides and auto increment id for each record.

**NEVER USE THIS ID IN YOUR APPLICATIONS**

### c

The c column indicates whether or not record data is compressed. The c
column will only be created if a data column is present.

0 indicates that data is not commpressed and 1 indicates that data is
compressed using snappy.

### d

The d column indicates whether or not the record is deleted.

0 indicates that the record is not deleted and 1 indicates that the record
is deleted.

### fooAccountId

The accountId of the account that owns the foo object.

### fooCreateTime

fooCreateTime is a microsecond timestamp generated using the micro-timestamp
module.

Timestamps are generated in the application and not in the database which is
necessary because fooId includes the timestamp in the data that is hashed.

### fooData

fooData is a JSON encoding of the foo object using the
[json-stable-stringify](https://www.npmjs.com/package/json-stable-stringify)
module. This data is then compressed using the
[snappy](https://www.npmjs.com/package/snappy) module which is a binding for
Google's Snappy compression library.

### fooId

fooId is a hash of the JSON encoding of fooOriginalId, fooParentId, fooData,
fooCreateTime, sessionId, and accountId. The hash is calculated before any
compression is performed.

Undefined values are not included in the JSON encoding and the database driver
converts NULL values from the database to undefined so that they will not be
included in JSON encodings.

The hash value is the first 128 bits on an SHA-2 hash calculated using the
[stable-id](https://www.npmjs.com/package/stable-id) module.

### fooOriginalId and fooParentId

The original and parent ids in Immutable Core Model are used to track object
revisions.

When a foo record is initially created its originalId will be equal to its id
and its parentId will be null.

When a revision to that record is created it will have the same originalId as
the first record and its parentId will be equal to the id of the first record.

#### fooId, fooOriginalId, fooParentId Example

Revision | fooId | fooOriginalId | fooParentId |
---------|-------|---------------|-------------|
1st      | 1111  | 1111          | NULL        |
2nd      | 2222  | 1111          | 1111        |
3rd      | 3333  | 1111          | 2222        |
4th      | 4444  | 1111          | 3333        |

#### Distributed Concurrency Control

The UNIQUE INDEX on parentFooId insures that in a multi-reader, multi-writer,
distributed system data does not become corrupted.

In order to create a new revision of foo it is necessary to provide the
parentFooId from the last version of foo fetched from the database.

If this record is outdated then the INSERT with that parentFooId will fail
because it has already been used by another writer.

In this case the client must abort or refetch the latest revision of foo and
retry.

### fooSessionId

The sessionId of the session that created the foo object.

## Setting the database engine for models

The database engine can be set either globally or on an individual model.

If the engine is specified on a model this will override any global value.

The database engine will not be changed or checked after the initial sync.

### Setting the database engine from the ENV

    DEFAULT_ENGINE=TokuDB node app.js

### Setting the database engine globally

    ImmutableCoreModel.defaultEngine('TokuDB')

When setting the defaultEngine the ImmutableCoreModel class object is returned
so that global configuration methods can be chained.

### Getting the global default database engine

    var defaultEngine = ImmutableCoreModel.defaultEngine()

### Setting the database engine on a model

    new ImmutableCoreModel({engine: 'TokuDB'})

## Setting the charset for models

The charset can be set either globally or on an individual model.

If the charset is specified on a model this will override any global value.

The charset will not be changed or checked after the initial sync.

### Setting the charset from the ENV

    DEFAULT_CHARSET=latin1 node app.js

### Setting the charset globally

    ImmutableCoreModel.defaultCharset('latin1')

When setting the defaultCharset the ImmutableCoreModel class object is returned
so that global configuration methods can be chained.

### Getting the global default charset

    var defaultCharset = ImmutableCoreModel.defaultCharset()

### Setting the charset on a model

    new ImmutableCoreModel({charset: 'latin1'})

## Creating a model with a JSON schema

    var fooModel = new ImmutableCoreModel({
        additionalProperties: false,
        errorMessage: {
            required: {
                foo: 'please enter foo'
            },
        },
        name: 'foo',
        properties: {
            foo: {
                type: 'string',
                default: 'foo',
            },
        },
        required: 'foo'
    })

The properties object is a list of [JSON Schema](https://spacetelescope.github.io/understanding-json-schema/index.html)
properties for the record data.

The schema specified here will be built into a schema for the complete object
including meta data columns (id, createTime, etc).

Properties with defaults will be added to the data.

Data type coercion will be performed so that numbers are converted to strings,
single element arrays are converted to scalar values, scalars are converted to
single element arrays, etc.

When additionalProperties:false is set any properties not in the schema will be
removed without throwing an error.

Immutable Core Model uses [ajv](https://www.npmjs.com/package/ajv) with the
following options to perform JSON schema validation:

    allErrors: true
    coerceTypes: 'array'
    removeAdditional: true
    useDefaults: true
    v5: true

[ajv-errors](https://www.npmjs.com/package/ajv-errors) is used to provide custom
error messages.

## Disabling schema validation at the model level

    var fooModel = new ImmutableCoreModel({
        name: 'foo',
        validate: false,
    })

JSON schema validation is enabled by default. To disable JSON schema validation
set the validate:false flag.

JSON schema validation can also be enabled and disabled for individual creat
and update calls.

Even if validation is disabled the schema and metaSchema properties of the model
will still be created.

## Disabling schema validation on create

    fooModel.createMeta({
        data: {foo: 'bar'},
        validate: false,
    })

## Disabling schema validation on update

    foo.updateMeta({
        data: {foo: 'bar'},
        validate: false,
    })

## Creating a model with queryable columns

    var fooModel = new ImmutableCoreModel({
        columns: {
            bam: 'boolean',
            bar: 'number',
            foo: 'string',
        },
        name: 'foo',
    })

While all of the object data for foo is stored in fooData it may be
necessary to query tables using column values.

Immutable Core Model allows for specifying additional columns that will be
created on the table schema.

Data for these columns will always match the values in fooData.

### Supported data types

Immutable Core Model supports the folowing data typesfor columns: boolean,
data, id, int, number, smallint, string and time.

boolean values must be either true or false.

data values must be JSON encodable and be able to be stored compressed in a
MEDIUMBLOB (~16MB).

id values must be specified as 32 char HEX string which will be stored as a
16 byte binary value.

strings have a maximum length of 255 characters. If strings exceed this length
then only the first 255 characters of the string will be stored in the
database column but the entire string will remain visible to the application.

numbers allow for a maximum of 27 digits before the decimal point and a
maximum of 9 digits after the decimal point.

time must be string that can be interpreted by MySQL as DATETIME.

### MySQL data type equivalents

Immutable Type | MySQL Type     |
---------------|----------------|
boolean        | TINYINT(1)     |
data           | MEDIUMBLOB     |
date           | DATE           |
id             | BINARY(16)     |
int            | BIGINT(20)     |
number         | DECIMAL(36,9)  |
smallint       | SMALLINT(5)    |
string         | VARCHAR(255)   |
time           | DATETIME(6)    |

### Creating a queryable column with non-default options

    var fooModel = new ImmutableCoreModel({
        columns: {
            foo: {
                default: 0,
                index: false,
                null: false,
                path: 'foo.bar',
                type: 'number',
            },
        },
        name: 'foo',
    })

When a column is created with a string value that string is used as the column
type and all other configuration options are set to defaults.

When a columen is created with an object value then non-default configuration
options can be set.

### Create a column with a unique index

    var accountModel = new ImmutableCoreModel({
        columns: {
            email: {
                type: 'string',
                unique: true,
            },
        },
        name: 'account',
    })

Because all the revisions of a record are stored in the same table a unique index
on a column would not allow revisions of a record to be inserted if the indexed
value did not change.

In order for this to work the value for the unique column is only inserted for
the first revision of the record and this column is left NULL for future
revisions unless the value changes.

To disable this behavior use the firstOnly:false option.

The firstOnly:true option is incompatible with the null:false option.

### Column options

Option Name | Default   | Description                                         |
------------|-----------|-----------------------------------------------------|
default     | null      | default value for column                            |
firstOnly   | true      | only apply unique index to original record          |
index       | true      | create index for column                             |
immutable   | false     | value cannot be changed after being set             |
null        | true      | allow null values                                   |
path        | undefined | path to get value from object (uses lodash _.get)   |
primary     | false     | column is primary key                               |
type        | undefined | data type (boolean|number|string)                   |
unique      | false     | create index as unique                              |
unsigned    | false     | create integer columns as unsigned                  |

## Creating multi-column indexes

    var fooModel = new ImmutableCoreModel({
        columns: {
            bam: 'boolean',
            bar: 'number',
        },
        indexes: [
            {
                columns: ['bam', 'bar'],
                unique: true
            },
        ],
        name: 'foo',
    })

Multi-column indexes must be specified separately from column specifications.

The indexes option can only be used for multi-column indexes and attempts to
create single column indexes will result in an error.

The unique flag controls whether or not the index is unique.

## Creating a model with unique id based on data only

    var fooModel = new ImmutableCoreModel({
        columns: {
            accountId: false,
            originalId: false,
            parentId: false,
        }
        idDataOnly: true,
        name: 'foo',
    })

When the idDataOnly flag is set then only the data values for an object will be
used to calculate the id for the object.

When creating models where the id is based only on the data it will usually not
make sense to allow revisions or ownership of records.

## Creating models with relations

    var fooModel = new ImmutableCoreModel({
        name: 'foo',
        relations: {
            bar: {},
        },
    })

    var barModel = new ImmutableCoreModel({
        columns: {
            fooId: {
                index: true,
                type: 'id',
            },
        },
        name: 'bar',
    })

Relations allow linked models to be created and queried from record objects.

In this example foo is related to bar.

The bar model must have either a fooId or fooOriginalId column.

For cases where the relation should apply to all revisions of a record the
originalId should be used. For cases where the relation only applies to a
specific revision the id should be used.

Relations are resolved at runtime which allows models to be defined in any
order.

### Creating models with relations linked via an intermediary table

    var fooModel = new ImmutableCoreModel({
        name: 'foo',
        relations: {
            bar: {via: 'bam'},
        },
    })

    var bamModel = new ImmutableCoreModel({
        columns: {
            barId: {
                index: true,
                null: false,
                type: 'id',
            },
            fooId: {
                index: true,
                null: false,
                type: 'id',
            },
            data: false,
            originalId: false,
            parentId: false,
        },
        name: 'bam',
    })

    var barModel = new ImmutableCoreModel({
        name: 'bar',
    })

The via option can be used to link two models via a third model.

The linking model should have either an id or originalId column from each of
the two models being linked.

### Creating a new related model

    var foo = fooModel.create(...)

    foo.create('bar', {foo: 'foo'})

To create a new related record the create method is call on an existing record
with the name of the related model and the data for the related record.

If the related record is linked via a third model the linking record will be
also be created.

### Creating a new related model with meta options

    foo.createMeta({
        data: {foo: 'foo'},
        relation: 'bar',
        session: session,
    })

The createMeta method can be used to set meta options for the create method.

### Selecting related records

    foo.select('bar')

The select method takes the name of a relation and queries all records related
to the record object.

The select method always returns a results object which must be used to fetch
or iterate over the related records.

### Querying related records

    foo.query({
        order: ['createTime'],
        relation: 'bar',
    })

The query method allows setting any of the options that are available with a
normal model query.

### Loading related records with query

    foo.query({
        where: {id: fooId},
        with: {
            bar: {
                order: ['createTime'],
            },
        },
    })

When doing a query for a single record by id related records can be loaded by
specifying the with option.

All records will be loaded so caution must be taken to make sure that this does
not become a performance and memory usage issue.

## Creating a model with transform functions

    var fooModel = new ImmutableCoreModel({
        name: 'foo',
        transform: {
            bam: (value, model, args) => {
                return 'bar'
            }
        }
    })

    fooModel.createMeta({
        data: {bam: 'foo'}
    })

Transform functions are called when creating or updating a record to modify
values set in the record data.

Transform functions will only be called if the value is defined in the data
passed to the create or update call.

Transform functions are called before schema validation.

The property name for the transform function will be resolved using lodash get
and can reference nested data.

## Access control for models

Immutable Core Model integrates with
[Immutable Access Control](https://www.npmjs.com/package/immutable-access-control)
to control access to records.

Access control rules should typically be configured independently from model
specifications but access control rules can be specified directly on the model.

This is primarily useful for setting default rules to deny access to a model so
that access must be specifically granted in order to use the model.

### Setting the Immutable Access Control provider

    var foo = new ImmutableCoreModel({
        accessControl: new ImmutableAccessControl(),
        name: 'foo',
    })

The access control provider for a model can be set via the accessControl
parameter when the model is created.

Immutable Access Control uses a global singleton instance so this will only
be needed if a custom access control provider is used.

### Deny access for all actions

    var foo = new ImmutableCoreModel({
        accessControlRules: ['0'],
        name: 'foo',
    })

Immutable Access Control is permissive by default. To deny access to all model
actions set the accessControlRules to an array with a single string as 0.

This is equivalent to calling Immutable Access Control with:

    accessControl.setRule(['all', 'model:foo:0'])

### Allowing access to specific actions

    var foo = new ImmutableCoreModel({
        accessControlRules: [
            '0',
            'create:1',
            'list:any:1',
            'read:any:1',
            'update:own:1',
        ],
        name: 'foo',
    })

All access control rules must be in the same form allowed by Immutable Access
Control except that they will have `model:<modelName>:` prepended to them.

These rules are equivalent to calling Immutable Access Control with:

    accessControl.setRules([
        ['all', 'model:foo:0'],
        ['all', 'model:foo:create:1'],
        ['all', 'model:foo:list:any:1'],
        ['all', 'model:foo:read:any:1'],
        ['all', 'model:foo:update:own:1'],
    ])

### Allowing access for specific roles

    var foo = new ImmutableCoreModel({
        accessControlRules: [
            '0',
            ['authenticated', 'list:any:1']
            ['authenticated', 'read:any:1']
        ],
        name: 'foo',
    })

These rules will allowed authenticated (logged in) sessions to list and read
records.

To specify roles(s) the access control rule must be passed as an array instead
of a string and one or more role must be specified prior to the rule.

These rules are equivalent to calling Immutable Access Control with:

    accessControl.setRules([
        ['all', 'model:foo:0'],
        ['authenticated', 'model:foo:list:any:1']
        ['authenticated', 'model:foo:read:any:1']
    ])

### Denying access

Access is checked before performing any action. If access is denied an error
will be thrown using
[Immutable App Http Error](https://www.npmjs.com/package/immutable-app-http-error)
which will generate a 403 Access Denied error when used with the Immutable App
framework.

### Setting a custom property for defining ownership

    var fooModel = new ImmutableCoreModel({
        accessIdName: 'barId',
        columns: {
            barId: {
                index: true,
                null: false,
                type: 'id',
            },
        },
        name: 'foo',
    })

By default accountId is used to determine ownership of records.

The accessIdName parameter can be used to specify a different property
to use for determining ownership of records.

This column must have the `id` type and should usually be indexed.

When a custom accessId property is used that property must be set on the session
in order for access to be granted based on ownership.

### Allowing access for queries

    var fooModel = new ImmutableCoreModel({
        name: foo,
    })

    var res = fooModel.query({
        allow: true,
    })

Access controls can not and do not provide security in the local context. Local
code can override access controls by passing the allow:true argument.

## Working with models

These examples use async/await to show how records can be created and queried.
It is assumed that this code will execute inside an async function.

### Creating a local model instance with session context

    // foo model import
    const globalFooModel = require('foo')

    // function where queries are performed
    async function () {
        var fooModel = globalFooModel.session(session)
    }

Calls to create, query, and select require a session object which will change
from one request to the next.

To make model calls less verbose and eliminate the risk of forgetting to pass
a session object with a call it is recommended to set the session context for
an object before using it locally.

If create, query, or select are called on a local instance of a model that has
a session context set they do not need to have a session object passed as an
argument but if one is passed it will override the existing session context.

### Creating a simple model with default options

    const mysql = ImmutableCoreModel.createMysqlConnection({ ... })

    var fooModel = new ImmutableCoreModel({
        mysql: mysql,
        name: 'foo',
    })

    await fooModel.sync()

### Creating a new record with a global model

    var foo = await globalFooModel.createMeta({
        data: {foo: 'foo'},
        session: session,
    })

To create a record with the global fooModel instance you must use the
createMeta method and include the session for the object being created.

The createMeta method can also be used for manually setting default columns
like accountId, createTime, and parentId.

### Creating a new record with a local model

    var fooModel = globalFooModel.session(session)

    fooModel.create({foo: 'foo'})

The local fooModel instance has a create method that takes only the record
data as an argument.

This is the prefered way to create new records.

The local fooModel instance also has a createMeta method which can be used
for any advanced create operations that require it.

### Creating a new record while ignoring duplicate key errors

    var foo = await globalFooModel.createMeta({
        data: {foo: 'foo'},
        duplicate: true,
        session: session,
    })

To ignore duplicate key errors when creating an object use the duplicate:true
flag.

If duplicate key errors are ignored the response data is not guaranteed to be
correct.

### Creating a new record while ignoring the response

    var foo = await globalFooModel.createMeta({
        data: {foo: 'foo'},
        duplicate: true,
        response: false,
        session: session,
    })

Set the response:false flag to not return a response.

This is typically used together with duplicate:true because the data returned
may not be correct if duplicate key errors are ignored.

### Creating a new record and responding with id only

    var foo = await globalFooModel.createMeta({
        data: {foo: 'foo'},
        duplicate: true,
        responseIdOnly: true,
        session: session,
    })

With the responseIdOnly:true option only the record id will be returned.

### Creating a new record without waiting for insert to complete

    var foo = await globalFooModel.createMeta({
        data: {foo: 'foo'},
        session: session,
        wait: false,
    })

    foo.promise.then( ... )

When createMeta is called with wait:false the response will be returned
immediately without waiting for the insert query to complete.

When wait:false is used the insert promise will be added to the record
object that is returned.

Errors will be caught by default when wait:false is used.

To prevent errors from being caught the catch:false option must be used.

### Persisting data with a local foo model

    var fooModel = globalFooModel.session(session)

    var fooId = await fooModel.persist({foo: 'foo'})

The persist method is available on local fooModel instances and is equivalent
to calling createMeta with duplicate:true and responseIdOnly:true set.

Calling persist will return a promise that resolves with the id of the persisted
record as a string.

response:false overrides responseIdOnly so if response:false is set nothing
will be returned.

### Record methods and properties

    foo = await fooModel.select.by.id(fooId)

    /* access properties */

    foo.data  // foo data object
    foo.id    // foo id

    /* call methods */

    foo.update(...)
    foo.empty()

Record objects follow a paradigm of accessing data via properties and performing
actions by calling methods.

Record objects also include toJSON and inspect methods to customize the
output provided for JSON.stringify and console.log.

### Common record methods

Method Name | Description                           |
------------|---------------------------------------|
inspect     | custom formater for console.log       |
toJSON      | custom formater for JSON.stringify    |

### Common record properties

Property Name | Description                                     |
--------------|--------------------------------------------------
model         | model record was create for                     |
raw           | raw database record with data column decoded    |
session       | session that instantiated record                |

### Default record properties

Property Name | Description                             |
--------------|-----------------------------------------|
accountId     | id of account that record belongs to    |
createTime    | record creation timestamp               |
data          | record data as plain object             |
id            | hash id of record                       |
originalId    | hash id of original record revision     |
parentId      | hash id of parent record revision       |
sessionId     | id of session that created record       |

### Updating a record

    foo = await foo.update({foo: 'bar'})

When a record is updated the data object passed as an argument will be merged
over the existing data using the lodash _.merge method.

The update method returns a new record object. Multiple attempts to
update the same record will fail so the new record returned by update must
always be captured if further updates will be performed.

By default the updated record inherits the accountId of the previous revision
of the record and the sessionId from the session that created or queried the
record being updated.

The updated record will always have the same originalId as the parent and
the parentId for the updated record will always be the id of the record
that was updated.

### Changing the accountId on a record

    foo = await foo.updateMeta({
        accountId: '2222'
    })

By default a record will have the same accountId as its parent. The accountId
must be passed as an argument to change it.

### Changing the sessionId on a record

    foo = await foo.updateMeta({
        session: session
    })

If a session is passed as an argument to the update method then that sessionId
will be assigned to the new record revision. Otherwise the sessionId from the
session that created or queried the record will be used.

### Forcing an update on an old record

    await foo.update({foo: 'bam'})

    await foo.updateMeta({
        data: {foo: 'bar'},
        force: true,
    })

By default calling update twice on the same record will result in a unique key
constraint violation and the update will throw an exception.

When updateMeta is called with force:true the update will be retried up to 3
times.

Each time the update operation is retried the current revision of the record
will be fetched and the data passed to the update statement will be re-merged
against the current record data.

Using force:true can very easily lead to data corruption and so it should be
used rarely if at all.

### Emptying record data

    foo = await foo.empty()

    foo = await foo.updateMeta({data: null})

The empty method creates a new record revision with an empty data object.

The empty method is an alias for calling updateMeta with data:null and accepts
the same arguments as updateMeta.

## Working with revisions

Immutable Core Model stores every revision to a record as another row in the
same table which exposes the revision history of a record to the client.

When doing a query on anything other than id only current record revisions will
be returned.

When querying a record by id the revision matching the queried id will be 
returned.

### Overwriting existing data

    foo = await foo.updateMeta({
        data: {foo: 'bar'},
        merge: false,
    })

With the merge:false flag set all existing data will be overwritten with the
value of the data property.

### Checking if a record is current

    foo = await foo.select.isCurrent.by.id(objectId)

    foo = await foo.query({
        isCurrent: true,
        where: { id: objectId }
    })

    if (foo.isCurrent) {
        ...
    }

When doing a query by id the isCurrent flag can be set to check if the
record(s) returned are the latest revisions.

isCurrent queries cannot be cached so this functionality should only be used
when necessary.

### Getting the current revision of a record

    foo = await foo.select.by.id(objectId)

    foo = await foo.current()

The current method queries the most recent revision of a record.

## Querying data

Immutable Core Model provides two methods for performing queries: query and
select.

The query method provides a raw low-level interface to all of the query
functionality that Immutable Core Model provides while the select method
provides shorthand helper methods that make simple queries easier to read
and write.

This section demonstrates both query and select by providing side-by-side
examples of the same query being performed with each.

Queries using the select method can only be performed on a local model
instance with a session context set.

### Select interface

    foo = await fooModel.select.all.order.by.foo

    foo = await fooModel.select.all.order.by.foo.query()

    foo = await fooMdoel.select.all.order.by.foo.then(
        res => { ... },
        err => { ... }
    )

The select interface works using
[JavaScript Proxies](https://developer.mozilla.org/en/docs/Web/JavaScript/Reference/Global_Objects/Proxy)

Every property access modifies the internal state of the select query and when
the query is executed the state is reset to perform the next query.

Every object retured by a property access returns a proxy object with query
and then methods defined on it.

Calling either query or then will execute the query returning a promise.

When await is used the then method is called implicitly.

### Query with plain object result

    foo = await fooModel.select.all.plain

    foo = await fooModel.query({
        all: true,
        plain: true,
    })

When the plain option is set plain objects will be returned instead of
ImmutableCoreModelRecord instances. The object returned is the same as the
result of calling `toJSON` on a record instance.

### Query a record by id

#### query

    foo = await fooModel.query({
        limit: 1,
        where: { id: objectId },
    })

#### select without session context set

    foo = await fooModel.session(session).select.by.id(objectId)

In this example session is called first to return a local instance of fooModel
with the session context set and then select is called on that instance.

The select method is not defined on the global model instance so attempts to
call it will result in an exception.

All further examples of the select method assume that a local model instance
with the session context set is being used.

#### select by id with session context set

    foo = await fooModel.select.by.id(objectId)

When doing a select.by query where the argument is a string the limit:1 option
will be set by default and the returned value will be either an object or
undefined.

When doing a select.by query where the argument is an array the all:true option
will be set by default and the returned value will be an array.

### Querying multiple records by id

To do an exact match on a column with multiple values use an array instead of
a string as the value to match against.

This is equivalent to SQL SELECT WHERE IN (...).

When selecting a list of records by id the records in the result will be in
the same order as the ids in the query but there is no guaratee that all of
the queried records will be returned.

#### query

    results = await fooModel.query({
        where: { id: [objectId1, objectId2, objectId3] }
    })

#### select

    results = await fooModel.select.by.id([objectId1, objectId2, objectId3])

### Rules for select.by queries

select.by.* queries can be performed on any column with select.by.id being the
most common use case.

#### select.by with single value

    foo = await fooModel.select.by.id('1111')

When a select.by query has a single value as an argument and the `all` option
is not used then either a record object or undefined will be retured.

#### select.all.by with a single value

    foos = await fooModel.select.all.by.id('1111')

When the `all` option is used the query will always return an array which will
be empty if no records were found.

#### select.by with an array value

    foos = await fooModel.select.by.id(['1111', '2222'])

When a select.by query is performed with an array value the `all` option is set
by default so an array will always be returned.

When doing a query for an array of ids the results will be in the same order
as the ids were queried. Ordering is not performed for queries other than id.

#### select.one.by with an array value

    foo = await fooModel.select.one.by.id(['1111', '2222'])

When the `one` option is used with an array of values only a single record
object or undefined will be returned.

There are no guarantees as to which record will be returned when multiple
records match the query.

#### Result object properties

Property Name | Description                                     |
--------------|-------------------------------------------------|
model         | model used to perform queries                   |
ids           | array of record ids in result set               |
session       | session used to perform queries                 |
length        | number of records in result set                 |
fetchNum      | number of records to fetch at a time            |
fetched       | number of records fetched                       |
buffer        | array buffer of fetched records                 |
done          | boolean flag indicating if all records fetched  |

#### Iterating over records with each

Records are accessed with the each method which iterates over the records,
fetching and buffering them when needed, and calls the provided callback
function for each.

    context = await result.each(function callback (record, number, context) {

    })

The callback function passed to each will be called for each record in order.

The arguments passed to the callback function are the record, the number of the
record in the set starting at 0, and a context object which is passed to each
callback.

If the callback function returns a promise this promise will be waited for
before continuing to the next record.

#### Calling each with a context object

The context object that is passed to the callback function can be specified
when calling each:

    var context = {foo: 'foo'}

    await results.each(callbackFunction, context)

Now context will be passed to callbackFunction with each iteration.

### Querying all matching records

When the all:true option is used all records will be returned immediately.

In cases where the result set is small this is more efficient than using a
response iterator but it is also dangerous because significant performance
impacts and out-of-memory errors may occur if the result set is too large.

It is recommended to use response iterators in most cases and only use query
all when the record size is known and an appropriate limit is set.

Query all must not be set to true if limit is set to 1.

#### query

    foo = await fooModel.query({
        all: true,
        limit: 100,
        where: { foo: { like: '%bar%' } },
    })

#### select

    foo = await fooModel.select.all.where.foo.like('%bar%').limit(100)

### Querying with order clauses

#### query

    foo = await fooModel.query({
        order: ['foo', 'desc']
    })

#### select

    foo = await fooModel.select.order.by.foo.desc
    foo = await fooModel.select.order.foo.desc

The by keyword in order selects is optional and the query will be the same with
or without it.

### Querying with multiple order clauses

#### query

    foo = await fooModel.query({
        order: [
            ['bam', 'bar', 'asc'],
            ['foo', 'desc'],
        ]
    })

#### select

    foo = await fooModel.select.order.by.bam.bar.asc.foo.desc

The asc/desc keywords split up column groups for order selects.

### Querying deleted records

#### query

    foo = await fooModel.query({
        where: { isDeleted: true }
    })

This query will return all record that have been deleted.

#### select

    foo = await fooModel.select.where.isDeleted(true)

### Querying records that have not been deleted

#### query

    foo = await fooModel.query({
        where: { isDeleted: false }
    })

This query returns all records that have not been deleted. the isDeleted:false
flag is set by default for all queries.

#### select

    foo = await fooModel.select.where.isDeleted(false)

### Querying both deleted and not-deleted records

#### query

    foo = await fooModel.query({
        where: { isDeleted: null }
    })

The isDeleted:false flag is set for all queries by default. The isDeleted:null
option is used to query both deleted and not-deleted records.

#### select

    foo = await fooModel.select.where.isDeleted(false)

### Querying the current revision of a record

#### query

    foo = await fooModel.query({
        current: true,
        limit: 1,
        where: { id: fooId }
    })

#### select

    foo = fooModel.select.current.by.id(fooId)

### Querying where column is null

#### query

    foo = await fooModel.query({
        where: { foo: null }
    })

#### select

    foo = await fooModel.select.where.foo.is.null
    foo = await fooModel.select.where.foo.null

### Querying where column is not null

#### query

    foo = await fooModel.query({
        where: { foo: { not: null } }
    })

#### select

    foo = await fooModel.select.where.foo.is.not.null
    foo = await fooModel.select.where.foo.not.null

### Querying where column greater than value

#### query

    foo = await fooModel.query({
        where: { bar: { gt: 5 } }
    })

#### select

    foo = await fooModel.select.where.bar.is.gt(5)
    foo = await fooModel.select.where.bar.gt(5)

### Querying where column greater than or equal to value

#### query

    foo = await fooModel.query({
        where: { bar: { gte: 5 } }
    })

#### select

    foo = await fooModel.select.where.bar.is.gte(5)
    foo = await fooModel.select.where.bar.gte(5)

### Querying where column is less than value

#### query

    foo = await fooModel.query({
        where: { bar: { lt: 5 } }
    })

#### select

    foo = await fooModel.select.where.bar.is.lt(5)
    foo = await fooModel.select.where.bar.lt(5)

### Querying where column is less than or equal to value

#### query

    foo = await fooModel.query({
        where: { bar: { lte: 5 } }
    })

#### select

    foo = await fooModel.select.where.bar.is.lte(5)
    foo = await fooModel.select.where.bar.lte(5)

### Querying where column equals a value

#### query

    foo = await fooModel.query({
        where: { bar: { eq: 5 } }
    })

#### select

    foo = await fooModel.select.where.bar.is.eq(5)
    foo = await fooModel.select.where.bar.eq(5)

### Querying where column does not equal a value

#### query

    foo = await fooModel.query({
        where: { bar: { not: { eq: 5 } } }
    })

#### select

    foo = await fooModel.select.where.bar.is.not.eq(5)
    foo = await fooModel.select.where.bar.not.eq(5)

### Querying records with results required

If the required:true option is used an error will be thrown if no results
are found.

#### query

    foo = await fooModel.query({required: true})

#### select

    foo = await fooModel.select.required.by.id('foo')
    foo = await fooModel.select.required.where.id.eq('foo')

When using the required keyword in a select statement it must come before
the by or where keywords.

## Model Views

Immutable Core Model uses
[Immutable Core Model View](https://www.npmjs.com/package/immutable-core-model-view)
to provide reusable and compositable methods for formatting and summarizing
record data.

Immutable Core Model Views can be included in the model definition, in which
case they will be available for use with every query, or ad-hoc model views
can be used with specific query instances.

### Creating a model with a model view

    var FooModelView = require('foo-model-view')

    var fooModel = new ImmutableCoreModel({
        name: 'foo',
        views: {
            default: ['foo'],
            foo: FooModelView(),
        },
    })

In this example the FooModelView is created as a named view `foo` for the
model. Additionally foo is added as a default view.

With foo set as a default model view it will be applied to every foo model
query.

Any number of named views can be added to a model and each naned view can be
either a single model view object, the name of a model view object, an array
of model view objects or an array of model view names.

Model view names are looked up in the local model views first and if not found
there they will be looked up in the global model view register.

### Creating a model with a globally registered model view

    require('foo-model-view')

    var fooModel = new ImmutableCoreModel({
        name: 'foo',
        views: {
            default: ['foo'],
        },
    })

This example will yield the same result as the first one. The name `foo` will
be used to find FooModelView in the global model view register and a new
instance of FooModelView will be created and used as the default view.

### Creating a model with multiple model views

    require('bam-model-view')
    require('bar-model-view')
    require('foo-model-view')

    var fooModel = new ImmutableCoreModel({
        name: 'foo',
        views: {
            default: ['viewA'],
            viewA: ['bam', 'bar'],
            viewB: ['bar', 'foo'],
        },
    })

In this example two named views are defined and both of them apply two model
views.

The default view references viewA and so the bam and bar model views will be
applied to all fooModel queries by default.

### Querying views

    var foo = fooModel.query({
        view: 'foo'
    })

    var foo = fooModel.query({
        view: ['foo', 'bar']
    })

One or more views can be specified with the view param on a query.

### Selecting views

    fooModel.select.view('foo')

    fooModel.select.view('foo', 'bar')

    fooModel.select.view(['foo', 'bar'])


The arguments to view can be either a single array or any number of strings.

### Selecting by id with views

    fooModel.select.one.where.id.eq(fooId).view(false)

It is not possible to specify a view when doing a select.by.id so the default
view will always be applied to select.by.id.

If a non-default view is needed for select.by.id the long form 
select.one.where approach must be used.

## Resolving related records

    var bar = barModel.create({bar: true})

    var foo = fooModel.create({
        bar: bar.id,
    })

    foo = fooModel.select.resolve.by.id(foo.id)

    // foo.data: {bar: {bar: true}}

When the resolve:true option is set record data will be search for model names
and model id names and the related records will be resolved.

The name of a model (e.g. bar) or the plural name (e.g. bars) will be resolved.

The id columns of model (e.g. barId, barOriginalId) and their plural version
(e.g. barIds, barOriginalIds) will be resolved and the value will be stored
under the model name or plural model name (e.g. bar, bars).

If a specific revision is referenced (e.g. barId) that revision will be
resolved. If originalId is used the the current revision of the record will
be resolved.

If the value is a string it will be replaced with the loaded record object or
undefined. If the value is an object the keys will be used as object ids and
the resolved records will be set as values. If the value is an array if will
be replaced with an array of the resolved objects. Ids that are not found will
not be returned.

Arrays of objects with an id column as a property will be resolved like arrays
of ids except that the name of the id column (fooId, fooOriginalId) will be
use to determine whether to query the specific id references or the current
record.

For string and array values they must be 32 char hex strings or they will not
be resolved and the original values will be left in place.

Deep properties are not resolved automatically.

### Resolving related records explicitly

    foo = fooModel.query({
        resolve: {
            'bar.bam': {
                isOriginalId: true,
                modelName: 'bam',
                setProperty: 'bamRecord',
            },
            baz: true,
        },
        where: {id: foo.id},
    })

When explicit values are set for resolve only the specified properties will
be resolved. While this is more verbose it is also more efficient and less
error prone.

The property name (e.g. `bam.bar`) will be accessed using lodash _.get so
deep properties can be resolved this way.

To resolve the property using default settings use the true value. Otherwise
and object with explicit options can be used to override defaults.

The `isOriginalId` flag is used to indicate that the current revision of the
referenced record should be resolved.

The `setProperty` option is used to specify a path that will be used with
lodash _.set to store the resolved record.

### Resolving related records with custom query args

    foo = fooModel.query({
        resolve: {
            foo: {
                queryArgs: {
                    ...
                },
            },
        },
        where: {id: foo.id},
    })

The `queryArgs` parameter will be merged over the query args for the query that
is used to get the record being resolved.

Any argument that can be passed to a `query` can be set in `queryArgs`.

## Using Elasticsearch

Immutable Core Model allows using
[Elasticsearch](https://www.elastic.co/guide/en/elasticsearch/reference/current/index.html)
in addition to MySQL.

When the elasticsearch parameter is set for a model then the current revision
of each record will be stored in Elasticsearch as well as MySQL.

Immutable Core Model updates the document in Elasticsearch whenever updates to
a record are made.

Elasticsearch storage is asynchronous and unreliable in the sense that if an
insert or update to Elasticsearch fails this is not treated as a fatal error.

The Elasticsearch index for a model will be created when model sync is called.

For an intro to Elasticsearch terminology used here see
[Elasticsearch Basic Concepts](https://www.elastic.co/guide/en/elasticsearch/reference/current/_basic_concepts.html)

## Adding Elasticsearch support to a model

    const elasticsearch = require('elasticsearch')

    const elasticsearchClient = new elistasticsearch.Client({
        host: 'localhost:9200',
    })

    // create model with elasticsearch client set as parameter
    var fooModel = new ImmutableCoreModel({
        elasticsearch: elasticsearchClient,
        name: 'foo',
    })

Passing an elasticsearch client at model creation will enable elasticsearch

    // create a model with elasticsearch enabled to set client later
    var barModel = new ImmutableCoreModel({
        elasticsearch: true,
        name: 'foo',
    })

    // set elastic search client
    barModel.elasticsearch(elasticsearchClient)

If elasticsearch is set to true and a sync is attempted without a client set
this will result in an exception.

All elasticsearch errors, including a missing client, are ignored for record
create.

## Setting the Elasticsearch client globally

    var barModel = new ImmutableCoreModel({
        elasticsearch: true,
        name: 'foo',
    })

    ImmutableCoreModel.elasticsearch(elasticsearchClient)

When the the elasticsearch client is set globally it will be used for all models
where the elasticsearch property is set to true. It will not be used for models
where an elasticsearch client instance has been set.

If a model is created after the client is set globally then the global
elasticsearch client will be set on the model when it is created.

If the global elasticsearch client is set after the model is created then it will
be set on the model the first time the model needs to use the elasticsearch
client.

## Adding an optional Elasticsearch client to a model

    var barModel = new ImmutableCoreModel({
        name: 'foo',
    })

    // set elastic search client
    barModel.elasticsearch(elasticsearchClient)

An elasticsearch client can be added to any model even if the model does not
require elasticsearch.

## Setting the Elasticsearch index name

    var fooModel = new ImmutableCoreModel({
        elasticsearch: client,
        esIndex: 'not-foo',
        name: 'foo',
    })

By default the model path (name converted to foo-bar-bam style) will be used as
the Elasticsearch index name. The esIndex property can be used to set a custom
name.

Elasticsearch does not allow capital letters in index names.

## Setting the Elasticsearch document type

    var fooModel = new ImmutableCoreModel({
        elasticsearch: client,
        esType: 'bar.bam',
        name: 'foo',
    })

    // 'baz' will become the elasticsearch document type
    fooModel.createMeta({
        data: {
            bar: { bam: 'baz' }
        },
        session: session,
    })

The value of the esType property is used with lodash _.get to retrieve a value
from the record data which is used as the document type.

If no esType property is set or the data is missing the property then the model
name will be used as the default type.

A JSON schema can be used to make the esType property required and define
allowed values for it.

## Performing a search

    var barModel = new ImmutableCoreModel({
        elasticsearch: true,
        name: 'foo',
    })

    varModel.search({
        query: { ... },
        raw: true,
        session: session,
    })

The search method args are passed directly to the
[elasticsearch](https://www.npmjs.com/package/elasticsearch) 
[search](https://www.elastic.co/guide/en/elasticsearch/client/javascript-api/current/api-reference.html#api-search)
method so any params accepted by that method can be passed to the model search
method.

The index for the search will be set to the index for the model by default.

When the raw property is set the raw results of the elasticsearch api query are
returned. Only raw mode is currently supported.

## Handling deleted records

If a model is deleted it will be deleted from Elasticsearch and if it is
un-deleted it will be inserted back into Elasticsearch.

## ImmutableCoreModel properties

Immutable Core Models have numerous properties that are used internally for
building queries, determining access, and other purposes.

These properties should be treated as read only and may be read only.

To the greatest extent possible these properties will never be changed.

This list does not include all model properties. Undocumented properties are
subject to change and should not be relied upon.

 name                   | type    | description                                |
------------------------|---------|--------------------------------------------|
columns                 | object  | column specs by name                       |
defaultColumns          | object  | model column name to default column name   |
defaultColumnsInverse   | object  | default column name to model column name   |
extraColumns            | object  | non-default column specs by name           |
columnNames             | array   | all column names                           |