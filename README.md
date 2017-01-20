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

## Creating a queryable column with non-default options

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

## Working with models

These examples will use async/await to demonstrate how new model instances
can be created and queried. It is assumed that this code will execute inside
an async function.

All code with await statements must be executed inside of try/catch
statements.

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

### Object instance accessor methods

Method Name | Description
-------------------------
accountId   | id of account that object belongs to
createTime  | object creation timestamp
data        | object data as plain object
id          | hash id of object
inspect     | custom formater for console.log
originalId  | hash id of original object revision
parentId    | hash id of parent object revision
sessionId   | id of session that created object
toJSON      | custom formater for JSON.stringify

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

Objects always get the sessionId of the session that created them. When an
update is performed on an object it is assumed that this operation is
occurring in the same session that the object was instantiated in.