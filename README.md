# immutable-core-model

Immutable Core Model builds on Immutable Core to persist immutable data to a
MySQL database.

Immutable Core Model is not an ORM in the traditional sense because it makes
no attempt to map objects to a relational schema. Instead Immutable Core Model
stores JSON serialized objects directly and then maps properties of those
objects to columns where needed for querying.

## Native async/await

Immutable Core Model requires Node.js v7.6.0 or greater with native async/await
support.

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

To disable compression create your model with:

    new ImmutableCoreModel({compression: false})

The same setting for compression must be used at all times. Uncompressed
records cannot be read when compression is on and compressed records cannot
be read when compression is off.

## Schema

For the simple example above the following schema will be created:

    CREATE TABLE foo (
        fooAccountId binary(16) NOT NULL,
        fooCreateTime datetime(6) NOT NULL,
        fooData MEDIUMBLOB NOT NULL,
        fooId binary(16) NOT NULL,
        fooOriginalId binary(16) NOT NULL,
        fooParentId binary(16) DEFAULT NULL,
        fooSessionId binary(16) NOT NULL,
        PRIMARY KEY (fooId),
        UNIQUE KEY (fooParentId),
        KEY (fooOriginalId),
        KEY (fooSessionId),
        KEY (fooAccountId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8

Immutable Core Model schemas follow the convention of creating lists of items
in alphabetical order.

### fooAccountId

The accountId of the account that owns the foo object.

### fooCreateTime

fooCreateTime is a microsecond timestamp generated using the micro-timestamp
module.

Timestamps are generated in the application and not in the database which is
necessary because fooId includes the timestamp in the data that is hashed.

### fooData

fooData is a JSON encoding of the foo object using the json-stable-stringify
module. This data is then compressed using the node-snappy module which is a
binding for Google's Snappy compression library.

### fooId

fooId is a hash of the JSON encoding of fooOriginalId, fooParentId, fooData,
fooCreateTime, sessionId, and accountId.

Undefined values are not included in the JSON encoding and the database driver
converts NULL values from the database to undefined so that they will not be
included in JSON encodings.

The hash value is the first 128 bits on an SHA-2 hash calculated using the
stable-id module.

### fooOriginalId and fooParentId

The original and parent ids in Immutable Core Model are used to track object
revisions.

When the first instance of a foo object is persisted its fooOriginalId will be
equal to its fooId and its fooParentId will be NULL.

When a revision to that object is persisted it will have the same fooOriginalId
as the first instance and fooParentId will be equal to the fooId of the first
instance.

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

    DEFAULT_ENGINE=MyISAM node app.js

### Setting the database engine globally

    ImmutableCoreModel.defaultEngine('MyISAM')

When setting the defaultEngine the ImmutableCoreModel class object is returned
so that global configuration methods can be chained.

### Getting the global default database engine

    var defaultEngine = ImmutableCoreModel.defaultEngine()

### Setting the database engine on a model

    new ImmutableCoreModel({engine: 'MyISAM'})

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
properties for the instance data.

The schema specified here will be built into a schema for the complete object
including meta data columns (id, createTime, etc).

Properties with default:true set will be added to the data.

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

## Disabling schema validation at the model level

    var fooModel = new ImmutableCoreModel({
        name: 'foo',
        validate: false,
    })

JSON schema validation is enabled by default. To disable JSON schema validation
set the validate:false flag.

JSON schema validation can also be enabled and disabled for individual created
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

While all of the object data for foo is stored in fooData it is often
necessary to query tables using column values.

Immutable Core Model allows for specifying additional columns that will be
created on the table schema.

Data for these columns will always match the values in fooData.

### Supported data types

Immutable Core Model supports six data types for columns: boolean, data, id,
number, string and time.

boolean values must be either true or false.

data values must be JSON encodable and be able to be stored compressed in a
MEDIUMBLOB (~16MB).

id values must be specified as 32 char HEX string which will be stored as a 16 byte binary value.

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
id             | BINARY(16)     |
number         | DECIMAL(36,9)  |
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

Suppose you are creating an account model where you would like to have an
email column that is unique so that only one account can exist per email
address.

Because Immutable Core Model stores all the revisions of a model in the same
table a unique index on a column would not allow revisions of an object to be
inserted if the indexed value did not change.

When the unique: true flag is set the firstOnly option will also be set by
default.

With the firstOnly flag set the value will only be inserted into the unique
indexed column when the first revision of the object is created or if the
indexed value changes.

To override this behavior you must set the firstOnly option to false.

With firstOnly true null must also be true.

### Column options

Option Name | Default   | Description                                         |
------------|-----------|-----------------------------------------------------|
default     | null      | default value for column                            |
index       | true      | create index for column                             |
immutable   | false     | value cannot be changed after creation              |
null        | true      | allow null values                                   |
path        | undefined | path to get value from object (uses lodash _.get)   |
primary     | false     | column is primary key                               |
type        | undefined | data type (boolean|number|string)                   |
unique      | false     | create index as unique                              |
firstOnly   | true      | only apply unique index to original object instance |

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

When creating models where the instance is based only on the data values it will
usually not make sense to have instances owned by individual accounts or to have
an originalId and parentId for revision tracking.

## Creating models with actions

    var fooModel = new ImmutableCoreModel({
        actions: {
            delete: true,
        },
        name: 'foo',
    })

Immutable Core Models can have associate actions such as delete, publish,
cancel, etc.

When the action is created with a boolean value this value determine whether
or not an inverse action is created.

In this case where the action delete: true is specified the inverse action
unDelete will also be created.

Actions have their own models with their own tables for storing data.

By default action models have only an id, createTime, sessionId and id column
that references the parent model or the parent action in the case of an 
inverse action.

When an Immutable Core Model Instance is created for the example model it will
have isDeleted and wasDelete properties and delete and unDelete methods added
to it.

The delete action as a default defaultWhere: false parameter so that by
default queries will not return deleted instances if a model has a delete
action added to it.

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

Relations allow linked models to be created and queried from model instances.

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

The via option can be used to link two models via a third table.

The linking table should have either an id or originalId column from each of
the two table being linked.

### Creating a new related model

    var foo = fooModel.create(...)

    foo.create('bar', {foo: 'foo'})

Calling the create method on a model instance with the name of the related
model.

If the related model is linked via a third table the linking record will be
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
to the instance.

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

    fooModel.query({
        limit: 1,
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

## Access control for models

Immutable Core Model integrates with
[immutable-access-control](https://www.npmjs.com/package/immutable-access-control)
to control access to records.

Access control rules should typically be configured independently from model
specifications.

Simple access control rules can be specified with the model. This is primarily
useful for setting default rules to deny access to a model so that access must
be specifically granted in order to use the model.

### Setting the Immutable Access Control provider

    var foo = new ImmutableCoreModel({
        accessControl: new ImmutableAccessControl(),
        name: 'foo',
    })

The access control provider for a model can be set via the accessControl
parameter when the model is created.

Since Immutable Access Control uses a global singleton instance this will only
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

These rules will allowed `authenticated` (i.e. logged in) sessions to list and
read records.

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
[immutable-app-http-error](https://www.npmjs.com/package/immutable-app-http-error)
which will generate a 403 Access Denied error when used with the Immutable App
framework.

### Setting a custom column for defining ownership

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

By default the accountId on a record is used to determine the ownership of a
record.

The accessIdName parameter can be used to specify a different column/property
to use for determining ownership of records.

This column should typically be of the `id` type and be indexed.

When a custom accessId property is used that property must be set on the session
in order for access to be granted based on ownership.

## Working with models

These examples will use async/await to demonstrate how new model instances
can be created and queried. It is assumed that this code will execute inside
an async function.

All code with await statements must be executed inside of try/catch
statements.

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
argument but if one is passed it will override the session context.

### Creating a simple model with default options

    var fooModel = new ImmutableCoreModel({
        database: database,
        name: 'foo',
    })

    await fooModel.sync()

### Creating a new object instance

    var foo = await globalFooModel.createMeta({
        data: {foo: 'foo'},
        session: session,
    })

To create an object instance with the global fooModel instance you must use the
createMeta method and include the session for the object being created.

The createMeta method can also be used for manually setting default columns like
accountId, createTime, and parentId.

### Creating a new object instance with a local foo model

    var fooModel = globalFooModel.session(session)

    fooModel.create({foo: 'foo'})

The local fooModel instance has a create method that takes only the instance
data as an argument.

This is the prefered way to create model instances.

The local fooModel instance also has the createMeta method which can be used
for any advanced create operations that require it.

### Creating a new object while ignoring duplicate key errors

    var foo = await globalFooModel.createMeta({
        data: {foo: 'foo'},
        duplicate: true,
        session: session,
    })

To ignore duplicate key errors when creating an object set the duplicate option
to true.

### Creating a new object while ignoring the response

    var foo = await globalFooModel.createMeta({
        data: {foo: 'foo'},
        duplicate: true,
        response: false,
        session: session,
    })

Set the response: false flag to not return a response. This is typically used
together with duplicate: true because if a duplicate key error is returned the
response may not be valid anyway since it is based on the input not what is in
the database.

### Creating a new object and responding with id only

    var foo = await globalFooModel.createMeta({
        data: {foo: 'foo'},
        duplicate: true,
        responseIdOnly: true,
        session: session,
    })

### Creating a new object without waiting for insert to complete

    var foo = await globalFooModel.createMeta({
        data: {foo: 'foo'},
        session: session,
        wait: false,
    })

    foo.promise.then( ... )

When createMeta is called with wait:false the response will be returned
immediately without waiting for the insert query to complete.

When wait:false is used the insert promise will be added to the model instance
object that is returned.

Errors will be caught be default when wait:false is used. To prevent errors from
being caught catch:false must be used with wait:false.

### Persisting data with a local foo model

    var fooModel = globalFooModel.session(session)

    var fooId = await fooModel.persist({foo: 'foo'})

The persist method is available on local fooModel instances and is equivalent
to calling createMeta with duplicate: true and responseIdOnly: true set.

Calling persist will return a promise that resolves with the id of the persisted
object as a string.

response: false overrides responseIdOnly so if response: false is set nothing
will be returned.

### Instance methods and properties

    foo = await fooModel.select.by.id(fooId)

    /* access properties */

    foo.data  // foo data object
    foo.id    // foo id

    /* call methods */

    foo.update(...)
    foo.empty()

Instance objects follow a strict paradigm of accessing data via properties and
performing actions by calling methods.

Methods for custom actions such as delete will be added to instance objects
when they are specified on the model.


Instance objects also include toJSON and inspect methods to customize the
output provided when serializing and console.log'ing objects.

### Common instance methods

Method Name | Description                           |
------------|---------------------------------------|
inspect     | custom formater for console.log       |
toJSON      | custom formater for JSON.stringify    |

### Common instance properties

Property Name | Description                                     |
--------------|--------------------------------------------------
model         | model instance was create from                  |
raw           | raw database record with data column decoded    |
session       | session that instantiated instance              |

### Default data instance properties

Property Name | Description                             |
--------------|-----------------------------------------|
accountId     | id of account that object belongs to    |
createTime    | object creation timestamp               |
data          | object data as plain object             |
id            | hash id of object                       |
originalId    | hash id of original object revision     |
parentId      | hash id of parent object revision       |
sessionId     | id of session that created object       |

### Updating an object instance

    foo = await foo.update({foo: 'bar'})

When an object is updated the data object passed as an argument will be merged
over the existing data using the lodash _.merge method.

The update method returns the new object instance. Multiple attempts to
update the same object will fail so the new object returned by update must
always be captured if further updates will be performed.

By default the updated instance inherits the session and accountId of the
parent instance.

The updated instance will always get the same originalId as the parent and
the parentId for the updated instance will always be the id of the parent.

### Updating the accountId on an object

    foo = await foo.updateMeta({
        accountId: '2222'
    })

By default an object will have the same accountId as its parent. The accountId
must be passed as an argument to change it.

### Changing the sessionId on an object

    foo = await foo.updateMeta({
        session: session
    })

If a session is passed as an argument to the update method then that sessionId
will be assigned to the new object revision. Otherwise the sessionId from the
session that original instantiated the local instance of the object will be
used.

### Forcing an update on an old instance

    await foo.update({foo: 'bam'})

    await foo.updateMeta({
        data: {foo: 'bar'},
        force: true,
    })

By default calling update twice on the same object will result in a unique
index conflict on the parentId column for the instance.

When updateMeta is called with force:true the update will be retried up to 3
times if an index conflict on the parentId column occurs.

Each time the update operation is retried the current instance of the object
will be fetched and the data passed to the update statement will be re-merged
against the current state of the data.

### Emptying object data

    foo = await foo.empty()

    foo = await foo.updateMeta({
        data: null
    })

The empty method will create a new revision of the object with an empty data
object.

The empty method is an alias for calling updateMeta with a null data property
and accepts the same arguments as updateMeta.

## Working with revisions

Immutable Core Model stores every revision to an object as another row in the
same table which exposes the revision history of an object to the client.

When doing a query on anything other than the id of an object only the current
revisions of the object will be retured.

When querying an object by id the revision matching the queried id will be
returned.

### Checking if an object is current

    foo = await foo.select.by.id(objectId)

    if (foo.isCurrent) {
        ...
    }

### Getting the current revision of an object

    foo = await foo.select.by.id(objectId)

    if (!foo.isCurrent) {
        foo = await foo.current()
    }

The current method will always query the database for the most recent revision
of the current object.

## Querying data

Immutable Core Model provides two methods for performing queries: query and
select.

The query method provides a raw low-level interface to all of the query
functionality that Immutable Core Model provides while the select method
provides shorthand helper methods that make common queries much simpler
to read and write.

This section demonstrates both query and select by providing side-by-side
examples of the same query being performed with each.

Queries using the select method can only be performed on a local model
instance with a session context set.

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

#### select with session context set

    foo = await fooModel.select.by.id(objectId)

When doing a select.by.id the limit for the query is automatically set to 1.

#### select a single record

    foo = await fooModel.select.one.by.foo('bar')

When doing a select.by on any column other than id select.one must be used
to return a single result.

### Querying multiple records by id

To do an exact match on a column with multiple values use an array instead of
a string as the value to match against.

This is equivalent to SQL SELECT WHERE IN (...).

#### query

    results = await fooModel.query({
        where: { id: [objectId1, objectId2, objectId3] }
    })

#### select

*not yet supported*

### Selecting specific columns

#### query

    foo = await fooModel.query({
        limit: 1,
        select: ['data'],
        where: { id: objectId },
    })

#### select

    foo = await fooModel.select(['data']).by.id(objectId)

### Querying multiple records with a results object

If no limit is set or the limit is greater than 1 and the all option is not
true then query will return a results object that is obtained by running the
query and only selecting the ids of the objects that match.

    results = await fooModel.query({
        where: { foo: { like: '%bar%' } }
    })

#### Results object properties

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

    context = await results.each(function callback (record, number, context) {

    })

The callback function passed to each will be called for each record with the
record, the number of the record in the set starting at 0, and a context
object which is passed to each callback and can be used to gather information
across callbacks.

If the callback function returns a promise this promise will be waited for
before continuing to the next record.

#### Calling each with a context object

The context object that is passed to the callback function can be specified
when calling each:

    var context = {foo: 'foo'}

    await results.each(callbackFunction, context)

Now context will be passed to callbackFunction with each iteration.

### Querying all matching records

When all is set to true all records matching the query will be returned
immediately.

In cases where the result set is small this is more efficient than using a
response iterator but it is also more dangerous because significant
performance impacts and even out-of-memory errors may occur if the result set
is too large.

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

    foo = await fooModel.select.order.by.foo.desc.query()
    foo = await fooModel.select.order.foo.desc.query()

The by keyword in order selects is optional and query will be performed the
same with or without it.

### Querying with multiple order clauses

#### query

    foo = await fooModel.query({
        order: [
            ['bam', 'bar', 'asc'],
            ['foo', 'desc'],
        ]
    })

#### select

    foo = await fooModel.select.order.by.bam.bar.asc.foo.desc.query()

The asc/desc keywords split up column groups for order selects.

### Querying objects where action has been performed

#### query

    foo = await fooModel.query({
        where: { isDeleted: true }
    })

This query will return all objects that have been deleted.

#### select

    foo = await fooModel.select.where.isDeleted(true).query()

### Querying objects where an action has not been performed

#### query

    foo = await fooModel.query({
        where: { isDeleted: false }
    })

This query will return all objects that have not been deleted.

#### select

    foo = await fooModel.select.where.isDeleted(false).query()

### Querying objects where an action either has or has not been performed

#### query

    foo = await fooModel.query({
        where: { isDeleted: null }
    })

In the case of the delete action where by default queries return only
isDeleted: false records the isDeleted: null where query can be added to
return all objects whether or not they have been deleted.

#### select

    foo = await fooModel.select.where.isDeleted(false).query()

### Querying the current version of an object by id

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

    foo = await fooModel.select.where.foo.is.null.query()
    foo = await fooModel.select.where.foo.null.query()

### Querying where column is not null

#### query

    foo = await fooModel.query({
        where: { foo: { not: null } }
    })

#### select

    foo = await fooModel.select.where.foo.is.not.null.query()
    foo = await fooModel.select.where.foo.not.null.query()

### Querying where column greater than value

#### query

    foo = await fooModel.query({
        where: { bar: { gt: 5 } }
    })

#### select

    foo = await fooModel.select.where.bar.is.gt(5).query()
    foo = await fooModel.select.where.bar.gt(5).query()

### Querying where column greater than or equal to value

#### query

    foo = await fooModel.query({
        where: { bar: { gte: 5 } }
    })

#### select

    foo = await fooModel.select.where.bar.is.gte(5).query()
    foo = await fooModel.select.where.bar.gte(5).query()

### Querying where column is less than value

#### query

    foo = await fooModel.query({
        where: { bar: { lt: 5 } }
    })

#### select

    foo = await fooModel.select.where.bar.is.lt(5).query()
    foo = await fooModel.select.where.bar.lt(5).query()

### Querying where column is less than or equal to value

#### query

    foo = await fooModel.query({
        where: { bar: { lte: 5 } }
    })

#### select

    foo = await fooModel.select.where.bar.is.lte(5).query()
    foo = await fooModel.select.where.bar.lte(5).query()

### Querying where column equals a value

#### query

    foo = await fooModel.query({
        where: { bar: { eq: 5 } }
    })

#### select

    foo = await fooModel.select.where.bar.is.eq(5).query()
    foo = await fooModel.select.where.bar.eq(5).query()

### Querying where column does not equal a value

#### query

    foo = await fooModel.query({
        where: { bar: { not: { eq: 5 } } }
    })

#### select

    foo = await fooModel.select.where.bar.is.not.eq(5).query()
    foo = await fooModel.select.where.bar.not.eq(5).query()

## Model Views

Immutable Core Model uses Model Views to provide reusable and compositable
methods for formatting and summarizing model data.

Model views created with immutable-core-model-view can be included in the
model definition, in which case they will be available for use with every
query, or ad-hoc model views can be used with specific query instances.

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

Now on every query foo model view will be applied to the result records.

Any number of named views can be to a model and each naned view can be either
a single model view object or an array of model view objects or model view
names.

Model view names will first be resolved against the model's views but if a
name is not specifically defined for the model it will be resolved against
the global model view register instead.

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

In this example two named views are defined both of them applied two model
views. Then one of these named views is made the default view for the model.

Whenever records are queried from fooModel viewA will be applied by default
which means that the bam and bar views will be applied.

### Querying views

    var foo = fooModel.query({
        view: 'foo'
    })

    var foo = fooModel.query({
        view: ['foo', 'bar']
    })

Either one or more views can be specified with the view param on a query.

### Selecting views

    fooModel.select.view('foo')

    fooModel.select.view('foo', 'bar')

    fooModel.select.view(['foo', 'bar'])

The view method on a select acts the same as query. view must be called at
the end of the select and the query will be executed with the specified
view(s).

The arguments to view can be either a single array or any number of strings.

### Selecting by id with views

    fooModel.select.one.where.id.eq(fooId).view(false)

It is not possible to specify a view when doing a select.by.id so the default
view will always be applied to select.by.id.

If a non-default view is needed for select.by.id the long form 
select.one.where approach must be used.

## Using Elasticsearch

Immutable Core Model allows using
[Elasticsearch](https://www.elastic.co/guide/en/elasticsearch/reference/current/index.html)
in addition to MySQL.

When the `elasticsearch` parameter is set for a model then the current revision
of each model instance will be stored in Elasticsearch as well as MySQL.

Immutable Core Model updates the document in Elasticsearch whenever instance
updates are made.

Elasticsearch storage is asynchronous and unreliable in the sense that if an
insert or update to Elasticsearch fails this is not treated as a fatal error.

The Elasticsearch index for a model will be created when model sync is called.

For an intro to Elasticsearch terminology used here see
[Elasticsearch Basic Concepts]https://www.elastic.co/guide/en/elasticsearch/reference/current/_basic_concepts.html

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

If a model is create after the client is set globally then the global
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
        esIndex: 'notFoo',
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

    // 'baz' will be come the elasticsearch document type
    fooModel.createMeta({
        data: {
            bar: { bam: 'baz' }
        },
        session: session,
    })

The value of the esType property is used with lodash _.get to retrieve a value
from the instance data which is used as the document type.

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

## Storing action data

Whenever an action is performed on an instance the Elasticsearch document will
be updated with the results of that action.

Because actions are linked to specific instances any time an instance is updated
the new revision will have no actions performed on it.

## Handling deleted records

If a model has a delete action it will be deleted from Elasticsearch if a
delete is performed.

If a model has an unDelete action it will be added back to Elasticsearch if the
unDelete action is performed.