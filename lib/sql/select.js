'use strict'

/* native modules */
const assert = require('assert')

/* npm modules */
const _ = require('lodash')
const defined = require('if-defined')
const requireValidOptionalObject = require('immutable-require-valid-optional-object')

/* exports */
module.exports = SqlSelect

/* constants */
const matchOperators = {
    between: true,
    eq: true,
    gt: true,
    gte: true,
    in: true,
    like: true,
    lt: true,
    lte: true,
}

/**
 * @function SqlSelect
 *
 * create new sql select query builder instance
 *
 * @param {ImmutableCoreModel} model
 * @param {object} args
 *
 * @returns {SqlSelect}
 */
function SqlSelect (model, args) {
    // capture input
    this.model = model
    this.args = _.cloneDeep(args)
    // make sure where is defined in args
    this.args.where = requireValidOptionalObject(this.args.where)

    // map of alias => table
    this.aliases = {}
    // map of table => alias - since the same table can be used multiple times
    // in query the canonical alias for a table is the one that data is being
    // selected from 
    this.tableAliases = {}

    // primary table name
    this.table = model.name
    // primary table alias
    this.alias = this.getAlias(this.table)

    // list of related model names joined on
    this.joinRelationNames = []
    // map of related models joined on with join config
    this.joinRelations = {}

    // list of columns to select
    this.select = []
    // list of join statements
    this.join = []
    // list of where statements
    this.where = []
    // list of order statements
    this.order = []
    // limit for query
    this.limit = undefined
    // offset for query
    this.offset = undefined

    // params for query placeholder => value
    this.params = {}

    // check if query is select by id
    this.checkSelectById()
    // check if query should select only ids
    this.checkSelectOnlyIds()

    // execute simple selectById if this is an id query with no extra flags
    if (this.isSelectById) {
        this.selectById()
    }
    // execute generic query builder
    else {
        // add access control checks
        this.addAccessControl()
        // build joins on relations
        this.buildJoinRelations()
        // build list of columns from the primary table to select
        this.buildSelect()
        // get the queried revision(s) of objects
        this.buildRevision()
        // build where args
        _.each(this.args.where, (value, name) => this.buildWhere(name, value))
        // build order args
        this.buildOrder()
        // build full sql SELECT statement
        this.buildSql()
    }
}

/* public methods */
SqlSelect.prototype = {
    addAccessControl: addAccessControl,
    buildJoinRelation: buildJoinRelation,
    buildJoinRelations: buildJoinRelations,
    buildLeftJoinRelations: buildLeftJoinRelations,
    buildOrder: buildOrder,
    buildOrderArray: buildOrderArray,
    buildRevision: buildRevision,
    buildSelect: buildSelect,
    buildSql: buildSql,
    buildWhere: buildWhere,
    buildWhereModel: buildWhereModel,
    buildWhereRelation: buildWhereRelation,
    buildWhereRelationDirect: buildWhereRelationDirect,
    buildWhereRelationVia: buildWhereRelationVia,
    checkSelectById: checkSelectById,
    checkSelectOnlyIds: checkSelectOnlyIds,
    getAlias: getAlias,
    hexId: hexId,
    joinSql: joinSql,
    leftJoinSql: leftJoinSql,
    newAlias: newAlias,
    newParam: newParam,
    quoteName: quoteName,
    selectById: selectById,
    selectByIdWhereSql: selectByIdWhereSql,
    selectColumnSql: selectColumnSql,
    toJSON: toJSON,
    unhexId: unhexId,
    // class properties
    class: 'SqlSelect',
    SqlSelect: true,
}

SqlSelect.matchOperators = matchOperators

/**
 * @function addAccessControl
 *
 * add access id column to where clause
 *
 * @throws {Error}
 */
function addAccessControl () {
    // no access control if accessIdName not set
    if (!defined(this.args.accessIdName)) {
        return
    }
    // access id column is on primary table/record
    var alias = this.alias
    // validate column name - throw error
    var column = this.model.columnName(this.args.accessIdName, true)
    // get quoted column name
    column = this.quoteName(column)
    // get param name for value placeholder
    var paramName = this.newParam(this.args.accessIdName)
    // set value for param placeholder
    this.params[paramName] = this.args.accessId
    // add UNHEX for binary ids
    var placeholder = this.unhexId(`:${paramName}`)
    // add where SQL
    this.where.push(`${alias}.${column} = ${placeholder}`)   
}

/**
 * @function buildJoinRelations
 *
 * build joins on relations
 *
 * @throws {Error}
 */
function buildJoinRelations () {
    // if no joins specified then do nothing
    if (!defined(this.args.join)) {
        return
    }
    // get join as array
    var joins = Array.isArray(this.args.join) ? this.args.join : [this.args.join]
    // add each join
    _.each(joins, join => {
        // join may be passed as string that is name of relation to join on
        if (typeof join === 'string') {
            join = {
                relation: join,
            }
        }
        // require join to be object
        assert.ok(join && typeof join === 'object', 'left join must be string or object')
        // add join to query
        this.buildJoinRelation(join)
    })
}

/**
 * @function buildJoinRelation
 *
 * bulid join relation - if boolean flag is true it will be LEFT JOIN
 *
 * @param {object} join
 *
 * @throws {Error}
 */
function buildJoinRelation (join) {
    // if there is already a join on this relation then throw error
    assert.ok(!this.joinRelations[join.relation], 'join already exists for '+join.relation)
    // get relation for join
    var relation = this.model.relation(join.relation)
    // add join to joins
    this.joinRelations[join.relation] = join
    this.joinRelationNames.push(join.relation)
    // create alias for relation table to use in query
    join.relationAlias = this.newAlias(relation.model.name)
    // if join is via another model then join on that table
    if (relation.via) {
        // create alias for via table to use in query
        join.viaAlias = this.newAlias(relation.viaModel.name)
        // add join on alias table to query
        this.join.push( this.joinSql(relation.viaModel.name, join.viaAlias, relation.viaModelIdColumn, this.alias, relation.modelIdColumn, join.left ? 'LEFT JOIN' : 'JOIN') )
        // add join from alias to relation table to query
        this.join.push( this.joinSql(relation.model.name, join.relationAlias, relation.relationIdColumn, join.viaAlias, relation.viaRelationIdColumn, join.left ? 'LEFT JOIN' : 'JOIN') )
    }
    // join directly to related table
    else {
        this.join.push( this.joinSql(relation.model.name, join.relationAlias, relation.relationIdColumn, this.alias, relation.modelIdColumn, join.left ? 'LEFT JOIN' : 'JOIN') )
    }
}

/**
 * @function buildLeftJoinRelations
 *
 * build left joins on relations
 *
 * @throws {Error}
 */
function buildLeftJoinRelations () {
    // if no left joins specified do nothing
    if (!this.args.left || !this.args.left.join) {
        return
    }
    // get join as array
    var joins = Array.isArray(this.args.left.join) ? this.args.left.join : [this.args.left.join]
    // add each join
    _.each(joins, join => {
        // join may be passed as string that is name of relation to join on
        if (typeof join === 'string') {
            join = {
                relation: join,
            }
        }
        // require join to be object
        assert.ok(join && typeof join === 'object', 'left join must be string or object')
        // set the left join flag to true
        join.left = true
        // add join to query
        this.buildJoinRelation(join)
    })
}

/**
 * @function buildOrder
 *
 * build list of order clauses
 *
 * @throws {Error}
 */
function buildOrder () {
    // convert string to array
    if (typeof this.args.order === 'string') {
        this.args.order = [this.args.order]
    }
    // do nothing if order args not set
    if (!Array.isArray(this.args.order) || !this.args.order.length) {
        return
    }
    // order can be array of strings or array of arrays - if first element
    // in order is array then treat as array of arrays
    Array.isArray(this.args.order[0])
        ? _.each(this.args.order, order => this.buildOrderArray(order))
        : this.buildOrderArray(this.args.order)
}

/**
 * @function buildOrderArray
 *
 * build order clause from array of columns with optional asc/desc
 *
 * @param {array} order
 *
 * @throws {Error}
 */
function buildOrderArray (order) {
    var direction = ''
    // check if last element is asc/desc
    if (order[order.length - 1].match(/^asc|desc$/i)) {
        var direction = order.pop().toUpperCase()
    }
    // join columns together and add direction
    this.order.push(
        _.map(order, columnName => {
            // split column on . to see if it has prefix
            var parts = columnName.split('.')
            // column does not have prefix
            if (parts.length === 1) {
                return this.alias+'.'+this.quoteName(this.model.columnName(columnName, true))
            }
            // column has prefix
            else if (parts.length === 2) {
                var prefix = parts[0]
                columnName = parts[1]
                // prefix must be for joined model
                assert.ok(this.joinRelations[prefix])
                // get join for table prefix
                var join = this.joinRelations[prefix]
                // get relation for model
                var relation = this.model.relation(prefix)
                // return order sql
                return join.relationAlias+'.'+this.quoteName(relation.model.columnName(columnName, true))
            }
            // error
            else {
                throw new Error('invalid column in order '+columnName)
            }
        }).join(', ')+' '+direction
    )
}

/**
 * @function buildRevision
 *
 * get the queried revision(s) of objects
 *
 */
function buildRevision () {
    // get id columns for primary table
    var parentIdColumn = this.model.columnName('parentId')
    var primaryIdColumn = this.model.columnName('id')
    var originalIdColumn = this.model.columnName('originalId')
    // must have original and parent ids to query revisions
    if (!originalIdColumn || !parentIdColumn) {
        return
    }
    // if this is a query by id then the logic and options are different
    if (this.args.where.id || this.args.where[primaryIdColumn]) {
        // if current revision is requested the join with self on originalId
        // and then join with self on parentId = id
        if (this.args.current) {
            // get alias to join on originalId
            var originalAlias = this.newAlias(this.table)
            // get alias to join on parent id
            var revisionAlias = this.newAlias(this.table)
            // add join on original id
            this.join.push( this.leftJoinSql(this.table, originalAlias, originalIdColumn, this.alias, originalIdColumn) )
            // add join on parent id
            this.join.push( this.leftJoinSql(this.table, revisionAlias, parentIdColumn, this.alias, primaryIdColumn) )
            // add where clause
            this.where.push( revisionAlias+'.'+this.quoteName(primaryIdColumn)+' IS NULL' )
            // get value of id where arg
            var whereIdArg = this.args.where.id || this.args.where[primaryIdColumn]
            // where must be applied to originalAlias table instead of table
            // being selected from so delete where from args and create the
            // where clause with the correct alias
            delete this.args.where.id
            delete this.args.where[primaryIdColumn]
            // add where clase with correct alias
            this.buildWhere('id', whereIdArg, originalAlias)
            // build alias for id that row was selected by
            var primaryIdColumnSelect = primaryIdColumn+'Select'
            // get column name
            var selectColumnName = this.hexId(`${originalAlias}.${this.quoteName(primaryIdColumn)}`)
            // add id being selected by to column list
            this.select.push(`LOWER(${selectColumnName}) AS ${this.quoteName(primaryIdColumnSelect)}`)
        }
        // if not selecting current revision then join with self on
        // parentId = id to check if record is current
        else if (this.args.isCurrent) {
            // get new alias for primary table
            var revisionAlias = this.newAlias(this.table)
            // add join
            this.join.push( this.leftJoinSql(this.table, revisionAlias, parentIdColumn, this.alias, primaryIdColumn) )
            // get column name
            var selectColumnName = this.hexId(`${revisionAlias}.${this.quoteName(primaryIdColumn)}`)
            // add column to select currentId
            this.select.push(`LOWER(${selectColumnName}) AS childId`)
        }
    }
    // if querying all revisions then join with self on parentId = id to check
    // if each record is current
    else if (this.args.allRevisions) {
        // get new alias for primary table
        var revisionAlias = this.newAlias(this.table)
        // add join
        this.join.push( this.leftJoinSql(this.table, revisionAlias, parentIdColumn, this.alias, primaryIdColumn) )
        // get column name
        var selectColumnName = this.hexId(`${revisionAlias}.${this.quoteName(primaryIdColumn)}`)
        // add column to select currentId
        this.select.push(`LOWER(${selectColumnName}) AS childId`)
    }
    // for non-id queries get current revision by joining with self on
    // parentId = id and only getting rows that have no children
    else {
        // get new alias for primary table
        var revisionAlias = this.newAlias(this.table)
        // add join
        this.join.push( this.leftJoinSql(this.table, revisionAlias, parentIdColumn, this.alias, primaryIdColumn) )
        // add where clause
        this.where.push(`${revisionAlias}.${this.quoteName(primaryIdColumn)} IS NULL`)
    }
}

/**
 * @function buildSelect
 *
 * build list of columns from the primary table to select
 *
 * @throws {Error}
 */
function buildSelect () {
    // list of columns to select
    var columns = this.isSelectOnlyIds ? ['id'] : this.model.columnNames
    // add columns to select list
    _.each(columns, columnName => {
        // validate column name - throw error
        columnName = this.model.columnName(columnName, true)
        // get column spec
        var spec = this.model.columns[columnName]
        // add select column sql
        this.select.push(
            this.selectColumnSql(this.model, columnName, spec, this.table)
        )
    })
}

/**
 * @function buildSql
 *
 * build full sql SELECT statement. when called the first time each part
 * of query will be saved to its own property. These properties can be
 * modified and then buildSql can be called again to rebuild only the main
 * sql including the modified proeprties.
 *
 * to rebuild the entire query including all the sub-parts the rebuild
 * flag can be passed.
 *
 * @param {boolean} rebuild
 *
 * @returns {string}
 */
function buildSql (rebuild) {
    // if sql has not been built before then build sub-parts
    if (!this.sql || rebuild) {
        this.selectSql = `SELECT ${this.select.join(', ')}`
        this.fromSql = `FROM ${this.quoteName(this.table)} ${this.alias}`
        this.joinSql = ''
        // create join sql
        if (this.join.length) {
            this.joinSql = this.join.join(' ')
        }
        this.whereSql = ''
        // create where sql
        if (this.where.length) {
            this.whereSql = 'WHERE '+this.where.join(' AND ')
        }
        this.orderSql = ''
        // create order sql
        if (this.order.length) {
            this.orderSql = 'ORDER BY '+this.order.join(', ')
        }
        this.limitSql = ''
        // create limit sql
        if (typeof this.args.limit === 'number') {
            var limit = parseInt(this.args.limit)
            this.limitSql = 'LIMIT '+limit
            // add offset
            if (typeof this.args.offset === 'number') {
                var offset = parseInt(this.args.offset)
                this.limitSql = this.limitSql+' OFFSET '+offset
            }
        }
    }
    // build full query
    this.sql = this.selectSql
        +' '+this.fromSql
        +(this.joinSql.length ? ' '+this.joinSql : '')
        +(this.whereSql.length ? ' '+this.whereSql : '')
        +(this.orderSql.length ? ' '+this.orderSql : '')
        +(this.limitSql.length ? ' '+this.limitSql : '')
}

/**
 * @function buildWhere
 *
 * build where clause from where argument
 *
 * @param {string} name
 * @param {array|boolean|object|string} value
 * @param {string|undefined} alias
 *
 * @throws {Error}
 */
function buildWhere (name, value, alias) {
    return name === 'relation'
        ? this.buildWhereRelation(name, value)
        : this.buildWhereModel(name, value, alias)
}

/**
 * @function buildWhereModel
 *
 * build where clause for primary model
 *
 * @param {string} name
 * @param {array|boolean|object|string} value
 * @param {string|undefined} alias
 *
 * @throws {Error}
 */
function buildWhereModel (name, value, alias) {
    // skip updefined values
    if (value === undefined) {
        return
    }
    // get id columns for model
    var idColumn = this.model.columnName('id')
    var originalIdColumn = this.model.columnName('originalId')
    // model column belongs to
    var model
    // column spec
    var spec
    // isDeleted where clause
    if (name === 'isDeleted') {
        // if value is null do nothing
        if (value === null) {
            return
        }
        // change column name to real column name (d)
        name = 'd'
    }
    // join column where clause
    if (name.match(/\./)) {
        var [prefix, column] = name.split('.')
        // prefix is for join
        if (this.joinRelations[prefix]) {
            // get join
            var join = this.joinRelations[prefix]
            // get relation
            var relation = this.model.relation(prefix)
            // set model for where clause
            model = relation.model
            // get column name from relation model
            name = model.columnName(column, true)
            // get spec
            spec = model.columns[name]
            // get alias
            alias = join.relationAlias
        }
        // error
        else {
            throw new Error('invalid column name in where '+name)
        }
    }
    // where clause for column on primary model table
    else {
        // model is base model
        model = this.model
        // validate column name - throw error
        name = this.model.columnName(name, true)
        // get column spec
        spec = this.model.columns[name]
        // if value is set for only the first column then need to add join to
        // select the record that matches the value
        if (spec.firstOnly) {
            // get new alias for primary table
            alias = this.newAlias(this.table)
            // add join
            this.join.push( this.joinSql(this.table, alias, originalIdColumn, this.alias, originalIdColumn) )
        }
    }
    // if optional alias is not set then get table alias for model name
    if (!alias) {
        alias = this.getAlias(model.name)
    }
    // flag set to true if this is negated statement
    var isNot = false
    // every where statement will begin with the alias and column name
    var whereSql = `${alias}.${this.quoteName(name)}`
    // if value is a string then do a simple column = :value
    if (typeof value === 'string' || typeof value === 'number') {
        // get param name for value placeholder
        var paramName = this.newParam(name)
        // set value for param placeholder
        this.params[paramName] = value
        // create sql
        whereSql += spec.type === 'id' && this.model.binaryIds
            ? ` = UNHEX(:${paramName})`
            : ` = :${paramName}`
    }
    // if value is boolean then do column = 1|0
    else if (spec.type === 'boolean' && typeof value === 'boolean') {
        // get param name for value placeholder
        var paramName = this.newParam(name)
        // create sql
        whereSql += ` = ${value ? 1 : 0}`
    }
    // if value is array then do IN () query
    else if (Array.isArray(value)) {
        var placeholders = _.map(value, v => {
            // get param name for each placeholder
            var paramName = this.newParam(name)
            // set value for param placeholder
            this.params[paramName] = v
            // create placeholder
            return spec.type === 'id' && this.model.binaryIds
                ? `UNHEX(:${paramName})`
                : `:${paramName}`
        })
        // create sql
        whereSql += ` IN(${placeholders.join(', ')})`
    }
    // if value is null then do IF NULL
    else if (value === null) {
        // create sql
        whereSql += ' IS NULL'
    }
    // if value is object then it should be a match type and value
    else if (typeof value === 'object') {
        // get keys of object
        var keys = _.keys(value)
        // there should be only one key
        assert.equal(keys.length, 1, 'statement must have one comparison operator in where '+name)
        // get operator
        var operator = keys[0]
        // get value
        var operatorValue = value[operator]
        var operatorValueType = typeof operatorValue
        // validate operator value
        if (operatorValueType === 'object' && operator !== 'in' && operator !== 'between' && operator !== 'not') {
            // if value is array change the type from object to array
            if (Array.isArray(operatorValue)) {
                operatorValueType = 'array'
            }
            // throw error
            throw new Error(`${model.name} query error: invalid value type '${operatorValueType}' for operator '${operator}'`)
        }
        // if operator is not then need to get next level deeper
        if (operator === 'not') {
            // if value is null than do IF NULL
            if (operatorValue === null) {
                // create sql
                whereSql += ' IS NOT NULL'
                // add sql to list of where clauses
                this.where.push(whereSql)
                // TODO: refactor this
                return
            }
            else {
                // get keys of not object
                keys = _.keys(operatorValue)
                // there should be only one key
                assert.equal(keys.length, 1, 'statement must have one comparison operator in where '+name)
                // get operator
                operator = keys[0]
                // get value
                operatorValue = operatorValue[operator]
                // set flag to negate statement
                isNot = true
            }
        }
        // LIKE :value
        if (operator === 'like') {
            // get param name for value placeholder
            var paramName = this.newParam(name)
            // set value for param placeholder
            this.params[paramName] = operatorValue
            // create sql
            whereSql += ` LIKE :${paramName}`
        }
        // > : value
        else if (operator === 'gt') {
            // get param name for value placeholder
            var paramName = this.newParam(name)
            // set value for param placeholder
            this.params[paramName] = operatorValue
            // create sql
            whereSql += ` > :${paramName}`
        }
        // >= : value
        else if (operator === 'gte') {
            // get param name for value placeholder
            var paramName = this.newParam(name)
            // set value for param placeholder
            this.params[paramName] = operatorValue
            // create sql
            whereSql += ` >= :${paramName}`
        }
        // < : value
        else if (operator === 'lt') {
            // get param name for value placeholder
            var paramName = this.newParam(name)
            // set value for param placeholder
            this.params[paramName] = operatorValue
            // create sql
            whereSql += ` < :${paramName}`
        }
        // <= : value
        else if (operator === 'lte') {
            // get param name for value placeholder
            var paramName = this.newParam(name)
            // set value for param placeholder
            this.params[paramName] = operatorValue
            // create sql
            whereSql += ` <= :${paramName}`
        }
        else if (operator === 'between') {
            assert.ok(Array.isArray(operatorValue), 'between value must be array in where '+name)
            assert.equal(operatorValue.length, 2, 'between array must have 2 elements in where '+name)
            // get param name for value placeholder
            var paramName1 = this.newParam(name)
            // set value for param placeholder
            this.params[paramName1] = operatorValue[0]
            // get param name for value placeholder
            var paramName2 = this.newParam(name)
            // set value for param placeholder
            this.params[paramName2] = operatorValue[1]
            // create sql
            whereSql += ` BETWEEN :${paramName1} AND :${paramName2}`
        }
        else if (operator === 'in') {
            assert.ok(Array.isArray(operatorValue), 'in value must be array in where '+name)
            // get placeholder for each in value
            var placeholders = _.map(operatorValue, v => {
                // get param name for each placeholder
                var paramName = this.newParam(name)
                // set value for param placeholder
                this.params[paramName] = v
                // create placeholder
                return spec.type === 'id' && this.model.binaryIds
                    ? `UNHEX(:${paramName})`
                    : `:${paramName}`
            })
            // create sql
            whereSql += ` IN(${placeholders.join(', ')})`
        }
        // = : value
        else if (operator === 'eq') {
            // get param name for value placeholder
            var paramName = this.newParam(name)
            // set value for param placeholder
            this.params[paramName] = operatorValue
            // create sql
            whereSql += spec.type === 'id' && this.model.binaryIds
                ? ` = UNHEX(:${paramName})`
                : ` = :${paramName}`
        }
        // operator type not supported
        else {
            throw new Error('invalid operator '+operator+' in where '+name)
        }
    }
    // query type not supported
    else {
        throw new Error('invalid value type '+typeof value+' in where '+name)
    }

    // if this is NOT statement then wrap in negation
    if (isNot) {
        whereSql = '!('+whereSql+')'
    }

    // add sql to list of where clauses
    this.where.push(whereSql)
}

/**
 * @function buildWhereRelation
 *
 * build where clause for related model
 *
 * @param {string} name
 * @param {array|boolean|object|string} value
 *
 * @throws {Error}
 */
function buildWhereRelation (name, value) {
    // require valid relation
    assert.ok(typeof value === 'object', 'invalid relation '+typeof value)
    // get relation
    var relation = this.model.relation(value.name)
    // build relation query
    return defined(relation.via)
        ? this.buildWhereRelationVia(name, value, relation)
        : this.buildWhereRelationDirect(name, value, relation)
}

/**
 * @function buildWhereRelationDirect
 *
 * build where clause for related model that is reference directly
 *
 * @param {string} name
 * @param {array|boolean|object|string} value
 * @param {object} relation
 *
 * @throws {Error}
 */
function buildWhereRelationDirect (name, value, relation) {
    // create alias for relation table to use in query
    var relationAlias = this.newAlias(relation.model.name)
    // get param name
    var paramName = this.newParam(relation.modelIdColumn)
    // get placeholder
    var placeholder = this.unhexId(`:${paramName}`)
    // build sql
    var whereSql = `${this.alias}.${this.quoteName(relation.modelIdColumn)} = ${placeholder}`
    // add value to params
    this.params[paramName] = value[relation.modelIdColumn]
    // add where clause to query
    this.where.push(whereSql)
}

/**
 * @function buildWhereRelationVia
 *
 * build where clause for related model that is reference via another model
 *
 * @param {string} name
 * @param {array|boolean|object|string} value
 * @param {object} relation
 *
 * @throws {Error}
 */
function buildWhereRelationVia (name, value, relation) {
    // get relation model
    var relationModel = relation.model
    // create alias for relation table to use in query
    var relationAlias = this.newAlias(relationModel.name)
    // get via model
    var viaModel = relation.viaModel
    // create alias for via table to use in query
    var viaAlias = this.newAlias(viaModel.name)
    // join model table to via table
    this.join.push( this.joinSql(viaModel.name, viaAlias, relation.viaModelIdColumn, this.alias, relation.modelIdColumn) )
    // get param name
    var paramName = this.newParam(relation.viaRelationIdColumn)
    // get placeholder
    var placeholder = this.unhexId(`:${paramName}`)
    // build sql
    var whereSql = `${viaAlias}.${this.quoteName(relation.viaRelationIdColumn)} = ${placeholder}`
    // add value to params
    this.params[paramName] = value[relation.viaRelationIdColumn]
    // add where clause to query
    this.where.push(whereSql)
    // if via model does not support delete then skip
    if (!defined(viaModel.columns.d)) {
        return
    }
    // get id column names for via table
    var viaIdColumn = viaModel.defaultColumnsInverse.id
    var viaParentIdColumn = viaModel.defaultColumnsInverse.parentId
    // create new alias for joining revisions
    var viaRevisionAlias = this.newAlias(viaModel.name)
    // join viaModel on self to get current revision
    this.join.push( this.leftJoinSql(viaModel.name, viaRevisionAlias, viaParentIdColumn, viaAlias, viaIdColumn) )
    // add where clause to skip old revisions
    this.where.push(`${viaRevisionAlias}.${this.quoteName(viaIdColumn)} IS NULL`)
    // add where clause to skip deleted records
    this.where.push(`${viaAlias}.d = 0`)
}

/**
 * @function checkSelectById
 *
 * set isSelectById flag
 */
function checkSelectById () {
    // default to false
    this.isSelectById = false
    // id column must be in where clause
    if (!defined(this.args.where.id)) {
        return
    }
    // id must be string or array being selected with all results
    if (typeof this.args.where.id !== 'string' && !(Array.isArray(this.args.where.id) && (this.args.all || this.args.one))) {
        return
    }
    // query with order and join not supported
    if (defined(this.args.order) || defined(this.args.join)) {
        return
    }
    // false if there are custom revision flags
    if (this.args.allRevisions || this.args.current || this.args.isCurrent) {
        return
    }
    // get number of properties for where
    var whereProps = _.keys(this.args.where).length
    // false if there are more than 2 (id, isDeleted) where props
    if (whereProps > 2) {
        return
    }
    // if there are 2 where props other must be isDeleted
    else if (whereProps === 2 && !defined(this.args.where.isDeleted)) {
        return
    }
    // query is select by id
    this.isSelectById = true
}

/**
 * @function checkSelectOnlyIds
 *
 * set isSelectOnlyIds flag
 */
function checkSelectOnlyIds () {
    // default to false
    this.isSelectOnlyIds = false
    // false if doing select by id
    if (this.isSelectById) {
        return
    }
    // false if selecting all and not using cache
    if (this.args.all && (!this.model.cache || this.args.cache === false)) {
        return
    }
    // false if selecting a single record
    if (this.args.limit === 1) {
        return
    }
    // false if selecting custom columns
    if (defined(this.args.select)) {
        return
    }
    // false if fetching isCurrent
    if (this.args.isCurrent) {
        return
    }
    // set to true if all negative tests passed
    this.isSelectOnlyIds = true
}

/**
 * @function getAlias
 *
 * returns existing table alias or creates new
 *
 * @param {string} tableName
 *
 * @returns {string}
 *
 * @throws {Error}
 */
function getAlias (tableName) {
    return this.tableAliases[tableName]
        // return existing alias
        ? this.tableAliases[tableName]
        // create new alias
        : this.newAlias(tableName)
}

/**
 * @function hexId
 *
 * wrap id column in HEX() function if binaryIds enabled
 *
 * @param {string} column
 *
 * @returns {string}
 */
function hexId (column) {
    return this.model.binaryIds ? `HEX(${column})` : column
}

/**
 * @function joinSql
 *
 * bulid sql for join with passed in join statement
 * join tableA aliasA ON aliasA.`column` = aliasB.`column`
 *
 * @param {string} join
 * @param {string} tableA
 * @param {string} aliasA
 * @param {string} columnA
 * @param {string} aliasB
 * @param {string} columnB
 *
 * @returns {string}
 *
 * @throws {Error}
 */
function joinSql (tableA, aliasA, columnA, aliasB, columnB, join) {
    // default to JOIN
    if (!join) {
        join = 'JOIN'
    }
    // if columbB not passed use same name as columnA
    if (!columnB) {
        columnB = columnA
    }
    // build sql
    return `${join} ${this.quoteName(tableA)} ${aliasA} ON ${aliasA}.${this.quoteName(columnA)} = ${aliasB}.${this.quoteName(columnB)}`
}

/**
 * @function leftJoinSql
 *
 * bulid sql for LEFT JOIN
 * LEFT JOIN tableA aliasA ON aliasA.`column` = aliasB.`column`
 *
 * @param {string} tableA
 * @param {string} aliasA
 * @param {string} columnA
 * @param {string} aliasB
 * @param {string} columnB
 *
 * @returns {string}
 *
 * @throws {Error}
 */
function leftJoinSql (tableA, aliasA, columnA, aliasB, columnB) {
    return this.joinSql(tableA, aliasA, columnA, aliasB, columnB, 'LEFT JOIN')
}

/**
 * @function newAlias
 *
 * create table alias
 *
 * @param {string} tableName
 *
 * @returns {string}
 *
 * @throws {Error}
 */
function newAlias(tableName) {
    // base of alias is first char of table name
    var alias = tableName.charAt(0)
    // get all upper case characters from table name
    var ucChars = tableName.match(/[A-Z]/g)
    // if table name has upper case chars then convert to lower and add
    if (ucChars) {
        alias = alias+ucChars.join('').toLowerCase()
    }
    var i = 0
    // get alias with digit appended
    while (i < 99) {
        var uniqueAlias = alias + i
        // if alias not in use then use it
        if (!this.aliases[uniqueAlias]) {
            // add alias to map of aliases
            this.aliases[uniqueAlias] = tableName
            // first table use is the one used for selecting values
            if (!this.tableAliases[tableName]) {
                this.tableAliases[tableName] = uniqueAlias
            }
            // return alias
            return uniqueAlias
        }
        // try next number
        i++
    }
    // if placeholder could not be found throw error
    throw new Error('max alias exceeded '+tableName)
}

/**
 * @function newParam
 *
 * get param name from column name
 *
 * @params {string} columnName
 *
 * @returns {string}
 *
 * @throws {Error}
 */
function newParam (columnName) {
    var i = 0
    // get placeholder name based on column name with counter
    // added if the same column name is used multiple times
    while (i < 99) {
        // use column name as base for param name
        var paramName = columnName+i
        // if param name is not in use then use it - caller will add
        // param to params map with value for substitution
        if (this.params[paramName] === undefined) {
            return paramName
        }
        // try next number
        i++
    }
    // if placeholder could not be found throw error
    throw new Error('max paramName exceeded '+columName)
}

/**
 * @function quoteName
 *
 * quote name for table/column/index
 *
 * @params {string} name
 *
 * @returns {string}
 *
 * @throws {Error}
 */
function quoteName (name) {
    // require name to be string
    assert.equal(typeof name, 'string', 'name must be string')
    // do not allow quote symbol in name - all other name validation is
    // left to the database
    assert.ok(!name.match(/`/), 'invalid name')
    // return quoted name
    return '`'+name+'`'
}

/**
 * @function selectById
 *
 * build select by id query
 *
 * @throws {Error}
 */
function selectById () {
    // always select all columns
    _.each(this.model.columnNames, columnName => {
        // get column spec
        var spec = this.model.columns[columnName]
        // add select column sql
        this.select.push(
            this.selectColumnSql(this.model, columnName, spec, this.table)
        )
    })
    // build query parts
    this.selectSql = `SELECT ${this.select.join(', ')}`
    this.fromSql = `FROM ${this.quoteName(this.table)} ${this.alias}`
    this.whereSql = this.selectByIdWhereSql()
    // build full query
    this.sql = `${this.selectSql} ${this.fromSql} ${this.whereSql}`
}

/**
 * @function selectByIdWhereSql
 *
 * build SQL for WHERE for select by id
 *
 * @returns {string}
 */
function selectByIdWhereSql () {
    // get id column
    var idColumn = this.model.columnName('id')
    // every where statement will begin with the alias and column name
    var columnSql = `${this.alias}.${this.quoteName(idColumn)}`
    // sql for where query
    var sql
    // if ids are array build in query
    if (Array.isArray(this.args.where.id)) {
        var i = 0
        // get placeholder for each in value
        var placeholders = _.map(this.args.where.id, id => {
            // get param name
            var paramName = `id${i}`
            // increment param counter
            i++
            // set value for param placeholder
            this.params[paramName] = id
            // create placeholder
            return this.unhexId(`:${paramName}`)
        })
        // return where sql
        sql = `WHERE ${columnSql} IN(${placeholders.join(', ')})`
    }
    // otherwise build equals query
    else {
        // set value for param placeholder
        this.params.id = this.args.where.id
        // get place holder
        var placeholder = this.unhexId(':id')
        // return where sql
        sql = `WHERE ${columnSql} = ${placeholder}`
    }
    // and deleted check if d column exists and set in args
    if (defined(this.model.columns.d) && typeof this.args.where.isDeleted === 'boolean') {
        sql += ` AND ${this.alias}.d = ${this.args.where.isDeleted ? 1 : 0}`
    }

    return sql
}

/**
 * @function selectColumnSql
 *
 * bulid sql for colummn in SELECT statement
 *
 * @param {object} model
 * @param {string} column
 * @param {object} spec
 * @param {string} alias
 * @param {string} as
 *
 * @returns {string}
 *
 * @throws {Error}
 */
function selectColumnSql (model, column, spec, alias, as) {
    // if alias is not registered then this should be a table name
    if (!this.aliases[alias]) {
        // create alias from table anme
        alias = this.getAlias(alias)
    }
    // base sql is alias.`column`
    var sql = alias+'.'+this.quoteName(column)
    // if column type is id then select HEX(alias.`column`) AS `column`
    if (spec.type === 'id' && model.binaryIds) {
        sql = 'LOWER(HEX('+sql+')) as '+this.quoteName(typeof as === 'string' ? as : column)
    }
    // if column type is data and compression then select
    // BASE_64(alias.`column`) AS `column`
    else if (spec.type === 'data' && model.compression) {
        sql = 'TO_BASE64('+sql+') as '+this.quoteName(typeof as === 'string' ? as : column)
    }
    // return column sql
    return sql
}

/**
 * @function toJSON
 *
 * custom toJSON
 */
function toJSON () {
    return _.omitBy(this, (val, key) => {
        if (typeof val === 'function') {
            return true
        }
        if (key === 'model') {
            return true
        }
    })
}

/**
 * @function unhexId
 *
 * wrap id column in UNHEX() function if binaryIds enabled
 *
 * @param {string} column
 *
 * @returns {string}
 */
function unhexId (column) {
    return this.model.binaryIds ? `UNHEX(${column})` : column
}