# immutable-core-model

Immutable Core Model builds on Immutable Core to persist immutable data to a
MySQL database.

Immutable Core Model is not an ORM in the traditional sense because it makes
no attempt to map objects to a relational schema.

Immutable Core Model uses native async/await and requires Node v7+ with
the --harmony-async-await flag as well as immutable-core v1+ and
immutable-database-mariasql v1+.

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

Revision | fooId | fooOriginalId | fooParentId
----------------------------------------------
1st      | 1111  | 1111          | NULL
2nd      | 2222  | 1111          | 1111
3rd      | 3333  | 1111          | 2222
4th      | 4444  | 1111          | 3333

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

Immutable Type | MySQL Type
----------------------------
boolean        | TINYINT(1)
data           | MEDIUMBLOB
id             | BINARY(16)
number         | DECIMAL(36,9)
string         | VARCHAR(255)
time           | DATETIME(6)

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

Option Name | Default   | Description
----------------------------------------
default     | null      | default value for column
index       | true      | create index for column
null        | true      | allow null values
path        | undefined | path to get value from object (uses lodash _.get)
primary     | false     | column is primary key
type        | undefined | data type (boolean|number|string)
unique      | false     | create index as unique
firstOnly   | true      | only apply unique index to original object instance

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

## Creating a model with actions

    var fooModel = new ImmutableCoreModel({
        actions: {
            delete: true,
        },
        database: database,
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

## Working with models

These examples will use async/await to demonstrate how new model instances
can be created and queried. It is assumed that this code will execute inside
an async function.

All code with await statements must be executed inside of try/catch
statements.

### Setting session context for queries

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

    var foo = await fooModel.create({
        data: {foo: 'foo'},
        session: session,
    })

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

Method Name | Description
-------------------------
inspect     | custom formater for console.log
toJSON      | custom formater for JSON.stringify

### Common instance properties

Property Name | Description
---------------------------
model         | model instance was create from
raw           | raw database record with data column decoded
session       | session that instantiated instance

### Default data instance properties

Property Name | Description
---------------------------
accountId     | id of account that object belongs to
createTime    | object creation timestamp
data          | object data as plain object
id            | hash id of object
originalId    | hash id of original object revision
parentId      | hash id of parent object revision
sessionId     | id of session that created object

### Updating an object instance

    foo = await foo.update({
        data: {foo: 'bar'}
    })

When an object is updated the data object passed as an argument will be merged
over the existing objet data using the lodash _.merge method.

The update method returns the new object instance. Multiple attempts to
update the same object will fail so the new object returned by update must
always be captured if further updates will be performed.

By default the updated instance inherits the session and accountId of the
parent instance.

The updated instance will always get the same originalId as the parent and
the parentId for the updated instance will always be the id of the parent.

### Updating the accountId on an object

    foo = await foo.update({
        accountId: '2222'
    })

By default an object will have the same accountId as its parent. The accountId
must be passed as an argument to change it.

### Changing the sessionId on an object

    foo = await foo.update({
        session: session
    })

If a session is passed as an argument to the update method then that sessionId
will be assigned to the new object revision. Otherwise the sessionId from the
session that original instantiated the local instance of the object will be
used.

### Emptying object data

    foo = await foo.empty()

    foo = await foo.update({
        data: null
    })

The empty method will create a new revision of the object with an empty data
object.

The empty method is an alias for calling update with a null data property and
accepts the same arguments as update.

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
        session: session,
        where: {
            id: objectId
        },
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
        session: session,
        where: {
            id: [objectId1, objectId2, objectId3]
        },
    })

#### select

*not yet supported*

### Selecting specific columns

#### query

    foo = await fooModel.query({
        limit: 1,
        select: ['data'],
        session: session,
        where: {
            id: objectId
        },
    })

#### select

    foo = await fooModel.select(['data']).by.id(objectId)

### Querying multiple records with a results object

If no limit is set or the limit is greater than 1 and the all option is not
true then query will return a results object that is obtained by running the
query and only selecting the ids of the objects that match.

    results = await fooModel.query({
        session: session,
        where: {
            foo: {like: '%bar%'}
        }
    })

#### Results object properties

Property Name | Description
---------------------------
model         | model used to perform queries
ids           | array of record ids in result set
session       | session used to perform queries
length        | number of records in result set
fetchNum      | number of records to fetch at a time
fetched       | number of records fetched
buffer        | array buffer of fetched records
done          | boolean flag indicating if all records fetched

#### Iterating over records with each

Records are accessed with the each method which iterates over the records,
fetching and buffering them when needed, and calls the provided callback
function for each.

    context = results.each(function callback (record, number, context) {

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

    results.each(callbackFunction, callback)

### Querying all matching records

When all is set to true all records matching the query will be returned
immediately.

In cases where the result set is small this is more efficient than using a
response iterator but it is also more dangerous because significant
performance impacts and even out-of-memory errors may occur if the result set
is too large.

It is recommended to use response iterators in most cases and only use query
all when the record size is known and an appropriate limit is set.

#### query

    foo = await fooModel.query({
        all: true,
        limit: 100,
        session: session,
        where: {
            foo: {like: '%bar%'}
        }
    })

#### select

*not yet supported*

### Querying with order clauses

#### query

    foo = await fooModel.query({
        all: true,
        limit: 100,
        order: ['foo', 'desc'],
        session: session,
        where: {
            foo: {like: '%bar%'}
        }
    })

#### select

*not yet supported*

### Querying with multiple order clauses

#### query

    foo = await fooModel.query({
        all: true,
        limit: 100,
        order: [
            ['bam', 'bar', 'asc'],
            ['foo', 'desc'],
        ],
        session: session,
        where: {
            foo: {like: '%bar%'}
        }
    })

#### select

*not yet supported*

### Querying objects where action has been performed

#### query

    foo = await fooModel.query({
        session: session,
        where: {
            isDeleted: true
        }
    })

This query will return all objects that have been deleted.

#### select

*not yet supported*

### Querying objects where an action has not been performed

#### query

    foo = await fooModel.query({
        session: session,
        where: {
            isDeleted: false
        }
    })

This query will return all objects that have not been deleted.

#### select

*not yet supported*

### Querying objects where an action either has or has not been performed

#### query

    foo = await fooModel.query({
        session: session,
        where: {
            isDeleted: null
        }
    })

In the case of the delete action where by default queries return only
isDeleted: false records the isDeleted: null where query can be added to
return all objects whether or not they have been deleted.

#### select

*not yet supported*