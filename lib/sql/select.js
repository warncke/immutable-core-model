'use strict'

/* native modules */
const assert = require('assert')

/* npm modules */
const _ = require('lodash')
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
    this.args = args
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

    // database driver options for query
    this.options = {}
    // params for query placeholder => value
    this.params = {}

    // if this is not a select all or select one then only ids will be
    // selected and response will go into a results object
    this.onlyIds = !this.args.all && this.args.limit !== 1 ? true : false
    // if only selecting ids then return result as array of arrays instead
    // of array of objects
    if (this.onlyIds) {
        this.options.useArray = true
    }

    // build list of columns from the primary table to select
    this.buildSelect()
    // get the queried revision(s) of objects
    this.buildRevision()
    // left join action tables and add to select unless onlyIds
    _.each(model.actions, (action, name) => this.addAction(action, name))
    // build where args
    _.each(args.where, (value, name) => this.buildWhere(name, value))
    // build order args
    this.buildOrder()

    // build full sql SELECT statement
    this.buildSql()
}

/* public methods */
SqlSelect.prototype = {
    addAction: addAction,
    buildOrder: buildOrder,
    buildOrderArray: buildOrderArray,
    buildRevision: buildRevision,
    buildSelect: buildSelect,
    buildSql: buildSql,
    buildWhere: buildWhere,
    buildWhereAction: buildWhereAction,
    getAlias: getAlias,
    joinSql: joinSql,
    leftJoinSql: leftJoinSql,
    newAlias: newAlias,
    newParam: newParam,
    quoteName: quoteName,
    selectColumnSql: selectColumnSql,
}

SqlSelect.matchOperators = matchOperators

/**
 * @function addAction
 *
 * left join action table and add to select unless onlyIds
 *
 * @param {object} action
 * @param {object} args
 * @param {string} name
 *
 * @throws {Error}
 */
function addAction (action, name) {
    // get table name for action model
    var actionTable = action.model.name
    // get alias for table
    var actionAlias = this.getAlias(actionTable)
    // get id column for action table
    var actionIdColumn = action.model.columnName('id')
    // get id column for primary table
    var primaryIdColumn = this.model.columnName('id')
    // add left join for action table to primary table
    this.join.push( this.leftJoinSql(actionTable, actionAlias, primaryIdColumn, this.alias) )
    // select action columns unless doing an id only query
    if (!this.onlyIds) {
        // add all action columns to query
        _.each(action.model.columns, (spec, column) => {
            // skip id column
            if (column === primaryIdColumn) {
                return
            }
            this.select.push( this.selectColumnSql(column, spec, actionTable) )
        })
    }

    // if there is a default where clause for action (e.g. isDelete: false)
    // and isProperty is not set in args then add default to Where query
    if (typeof action.defaultWhere === 'boolean' && this.args.where[action.isProperty] === undefined) {
        // add where clause
        this.buildWhereAction(action.isProperty, action.defaultWhere)
    }

    // skip adding inverse if not defined
    if (!action.inverse) {
        return
    }

    // get inverse table name
    var inverseTable = action.inverse.name
    // get inverse table alias
    var inverseAlias = this.getAlias(inverseTable)
    // get id column for action inverse table
    var inverseIdColumn = action.inverse.columnName('id')
    // add left join for inverse table
    this.join.push( this.leftJoinSql(inverseTable, inverseAlias, actionIdColumn, actionAlias) )
    // select action columns unless doing an id only query
    if (!this.onlyIds) {
        // add all action columns to query
        _.each(action.inverse.columns, (spec, column) => {
            // skip id column
            if (column === actionIdColumn) {
                return
            }
            // add column to select list
            this.select.push( this.selectColumnSql(column, spec, inverseTable) )
        })
    }

}

/**
 * @function buildOrder
 *
 * build list of order clauses
 *
 * @throws {Error}
 */
function buildOrder () {
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
        _.map(
            order, column => this.alias+'.'+this.quoteName(this.model.columnName(column, true))
        ).join(', ')+' '+direction
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
        }
        // if not selecting current revision then join with self on
        // parentId = id to check if record is current
        else {
            // get new alias for primary table
            var revisionAlias = this.newAlias(this.table)
            // add join
            this.join.push( this.leftJoinSql(this.table, revisionAlias, parentIdColumn, this.alias, primaryIdColumn) )
            // add column to select currentId
            this.select.push(
                'HEX('+revisionAlias+'.'+this.quoteName(primaryIdColumn)+') AS childId'
            )
        }
    }
    // if querying all revisions then join with self on parentId = id to check
    // if each record is current
    else if (this.args.allRevisions) {
        // get new alias for primary table
        var revisionAlias = this.newAlias(this.table)
        // add join
        this.join.push( this.leftJoinSql(this.table, revisionAlias, parentIdColumn, this.alias, primaryIdColumn) )
        // add column to select currentId
        this.select.push(
            'HEX('+revisionAlias+'.'+this.quoteName(primaryIdColumn)+') AS childId'
        )
    }
    // for non-id queries get current revision by joining with self on
    // parentId = id and only getting rows that have no children
    else {
        // get new alias for primary table
        var revisionAlias = this.newAlias(this.table)
        // add join
        this.join.push( this.leftJoinSql(this.table, revisionAlias, parentIdColumn, this.alias, primaryIdColumn) )
        // add where clause
        this.where.push( revisionAlias+'.'+this.quoteName(primaryIdColumn)+' IS NULL' )
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
    var columns
    // if only selecting ids then set columns
    if (this.onlyIds) {
        columns = ['id']
    }
    else {
        // if specific list of columns was passed the select those
        if (Array.isArray(this.args.select) && this.args.select.length) {
            columns = this.args.select
        }
        // otherwise select all
        else {
            columns = this.model.columnNames
        }
    }
    // add columns to select list
    _.each(columns, column => {
        // validate column name - throw error
        column = this.model.columnName(column, true)
        // get column spec
        var spec = this.model.columns[column]
        // add select column sql
        this.select.push(
            this.selectColumnSql(column, spec, this.table)
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
        this.selectSql = 'SELECT '+this.select.join(', ')
        this.fromSql = 'FROM '+this.table+' '+this.alias
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
 * @param {string} alias
 *
 * @throws {Error}
 */
function buildWhere (name, value, alias) {
    // if name is a flag for an action then apply different logic
    if (this.model.actionIsProperties[name]) {
        return this.buildWhereAction(name, value)
    }
    // get id columns for model
    var idColumn = this.model.columnName('id')
    var originalIdColumn = this.model.columnName('originalId')
    // model column belongs to
    var model
    // column spec
    var spec
    // if name contains a dot then split into action/column
    if (name.match(/\./)) {
        var [action, column] = name.split('.')
        // require valid action
        assert.ok(this.model.actions[action], 'invalid action '+action)
        // get action object
        action = this.model.actions[action]
        // use action model
        model = action.model
        // get column name from action model - throw error
        name = action.model.columnName(column, true)
        // get spec
        spec = action.model.columns[name]
    }
    else if (name === 'relation') {
        // require valid relation
        assert.ok(typeof value === 'object', 'invalid relation '+value)
        // get relation
        var relation = this.model.relation(value.name)
        // get relation model
        var relationModel = relation.model
        // create alias for relation table to use in query
        var relationAlias = this.newAlias(relationModel.name)
        // get relation id column names
        var relationIdColumn = relationModel.columnName('id')
        var relationOriginalIdColumn = relationModel.columnName('originalId')
        // build sql
        var whereSql
         // relation is via another table
        if (relation.via) {
            // get via model
            var viaModel = relation.viaModel
            // create alias for via table to use in query
            var viaAlias = this.newAlias(viaModel.name)
            // via table is join on id column
            if (viaModel.extraColumns[idColumn]) {
                // add join
                this.join.push( this.joinSql(viaModel.name, viaAlias, idColumn, this.alias) )
            }
            // via table is joined on originalId column
            else if (viaModel.extraColumns[originalIdColumn]) {
                // add join
                this.join.push( this.joinSql(viaModel.name, viaAlias, originalIdColumn, this.alias) )
            }
            else {
                throw new Error('cannot join via '+viaModel.name+' for relation '+value.name)
            }
            // relation table is joined to via on id column
            if (viaModel.extraColumns[relationIdColumn]) {
                // add join
                this.join.push( this.joinSql(relationModel.name, relationAlias, relationIdColumn, viaAlias) )
                // get param name
                var paramName = this.newParam(relationIdColumn)
                // build sql
                whereSql = relationAlias
                    +'.'+this.quoteName(relationIdColumn)
                    +' = UNHEX(:'+paramName+')'
                // add value to params
                this.params[paramName] = value.id
            }
            // relation table is joined to via on originalId column
            else if (viaModel.extraColumns[relationOriginalIdColumn]) {
                // add join
                this.join.push( this.joinSql(relationModel.name, relationAlias, relationOriginalIdColumn, viaAlias) )
                // get param name
                var paramName = this.newParam(relationOriginalIdColumn)
                // build sql
                whereSql = relationAlias
                    +'.'+this.quoteName(relationOriginalIdColumn)
                    +' = UNHEX(:'+paramName+')'
                // add value to params
                this.params[paramName] = value.originalId
            }
            else {
                throw new Error('cannot join via '+viaModel.name+' for relation '+value.name)
            }
        }
        // relation is direct
        else {
            // relation model is joined on id column
            if (this.model.extraColumns[relationIdColumn]) {
                // add join
                this.join.push( this.joinSql(relationModel.name, relationAlias, relationIdColumn, this.alias) )
                // get param name
                var paramName = this.newParam(relationIdColumn)
                // build sql
                whereSql = relationAlias
                    +'.'+this.quoteName(relationIdColumn)
                    +' = UNHEX(:'+paramName+')'
                // add value to params
                this.params[paramName] = value.id
            }
            // relation model is joined with originalId column
            else if (this.model.extraColumns[relationOriginalIdColumn]) {
                // add join
                this.join.push( this.joinSql(relationModel.name, relationAlias, relationOriginalIdColumn, this.alias) )
                // get param name
                var paramName = this.newParam(relationOriginalIdColumn)
                // build sql
                whereSql = relationAlias
                    +'.'+this.quoteName(relationOriginalIdColumn)
                    +' = UNHEX(:'+paramName+')'
                // add value to params
                this.params[paramName] = value.id
            }
            else {
                throw new Error('cannot join for relation '+value.name)
            }
        }
        // add where clause to query
        this.where.push(whereSql)
        // do not continue with regular where processing
        return
    }
    else {
        // model is base model
        model = this.model
        // validate column name - throw error
        name = this.model.columnName(name, true)
        // get column spec
        spec = this.model.columns[name]
    }
    // if optional alias is not set then get table alias for model name
    if (!alias) {
        alias = this.getAlias(model.name)
    }
    // flag set to true if this is negated statement
    var isNot = false
    // every where statement will begin with the alias and column name
    var whereSql = alias+'.'+name
    // if value is a string then do a simple column = :value
    if (typeof value === 'string' || typeof value === 'number') {
        // get param name for value placeholder
        var paramName = this.newParam(name)
        // set value for param placeholder
        this.params[paramName] = value
        // create sql
        whereSql = spec.type === 'id'
            // unhex the argument value to match binary id column
            ? whereSql+' = UNHEX(:'+paramName+')'
            : whereSql+' = :'+paramName
    }
    // if value is array then do IN () query
    else if (Array.isArray(value)) {
        var placeholders = _.map(value, v => {
            // get param name for each placeholder
            var paramName = this.newParam(name)
            // set value for param placeholder
            this.params[paramName] = v
            // create placeholder
            return spec.type === 'id'
                ? 'UNHEX(:'+paramName+')'
                : ':'+paramName
        })
        // create sql
        whereSql = whereSql+' IN('+placeholders.join(', ')+')'
    }
    // if value is null then do IF NULL
    else if (value === null) {
        // create sql
        whereSql = whereSql+' IS NULL'
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
        // if operator is not then need to get next level deeper
        if (operator === 'not') {
            // if value is null than do IF NULL
            if (operatorValue === null) {
                // create sql
                whereSql = whereSql+' IS NOT NULL'
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
            whereSql = whereSql+' LIKE :'+paramName
        }
        // > : value
        else if (operator === 'gt') {
            // get param name for value placeholder
            var paramName = this.newParam(name)
            // set value for param placeholder
            this.params[paramName] = operatorValue
            // create sql
            whereSql = whereSql+' > :'+paramName
        }
        // >= : value
        else if (operator === 'gte') {
            // get param name for value placeholder
            var paramName = this.newParam(name)
            // set value for param placeholder
            this.params[paramName] = operatorValue
            // create sql
            whereSql = whereSql+' >= :'+paramName
        }
        // < : value
        else if (operator === 'lt') {
            // get param name for value placeholder
            var paramName = this.newParam(name)
            // set value for param placeholder
            this.params[paramName] = operatorValue
            // create sql
            whereSql = whereSql+' < :'+paramName
        }
        // <= : value
        else if (operator === 'lte') {
            // get param name for value placeholder
            var paramName = this.newParam(name)
            // set value for param placeholder
            this.params[paramName] = operatorValue
            // create sql
            whereSql = whereSql+' <= :'+paramName
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
            whereSql = whereSql+' BETWEEN :'+paramName1+' AND :'+paramName2
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
                return spec.type === 'id'
                    ? 'UNHEX(:'+paramName+')'
                    : ':'+paramName
            })
            // create sql
            whereSql = whereSql+' IN('+placeholders.join(', ')+')'
        }
        // = : value
        else if (operator === 'eq') {
            // get param name for value placeholder
            var paramName = this.newParam(name)
            // set value for param placeholder
            this.params[paramName] = operatorValue
            // create sql
            whereSql = spec.type === 'id'
                ? whereSql+' = UNHEX(:'+paramName+')'
                : whereSql+' = :'+paramName
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
 * @function buildWhereAction
 *
 * build where clause for action isProperty
 *
 * @param {string} name
 * @param {boolean} value
 *
 * @throws {Error}
 */
function buildWhereAction (name, value) {
    // if value is not boolean do nothing - this is used to override defaults
    if (typeof value !== 'boolean') {
        return
    }
    // get action from isProperty name
    var action = this.model.actionIsProperties[name]
    // if action has inverse then WHERE needs to check inverse
    if (action.inverse) {
        this.where.push(
            '('+this.getAlias(action.model.name)
            +'.'+this.quoteName(action.model.columnName('id'))
            +' '+(value ? 'IS NOT NULL' : 'IS NULL')
            +(value ? ' AND ' : ' OR ')
            +this.getAlias(action.inverse.name)
            +'.'+this.quoteName(action.inverse.columnName('id'))
            +' '+(!value ? 'IS NOT NULL' : 'IS NULL')
            +')'
        )
    }
    // otherwise WHERE is only on action
    else {
        this.where.push(
            this.getAlias(action.model.name)
            +'.'+this.quoteName(action.model.columnName('id'))
            +' '+(value ? 'IS NOT NULL' : 'IS NULL')
        )
    }
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
    return join+' '+this.quoteName(tableA)+' '+aliasA
        +' ON '+aliasA+'.'+this.quoteName(columnA)+' = '
        +aliasB+'.'+this.quoteName(columnB)
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
 * @function selectColumnSql
 *
 * bulid sql for colummn in SELECT statement
 *
 * @param {string} column
 * @param {object} spec
 * @param {string} table
 *
 * @returns {string}
 *
 * @throws {Error}
 */
function selectColumnSql (column, spec, table) {
    // get table alias
    var alias = this.getAlias(table)
    // base sql is alias.`column`
    var sql = alias+'.'+this.quoteName(column)
    // if column type is id then select HEX(alias.`column`) AS `column`
    if (spec.type === 'id') {
        sql = 'HEX('+sql+') as '+this.quoteName(column)
    }
    // if column type is data and compression then select
    // BASE_64(alias.`column`) AS `column`
    else if (spec.type === 'data' && this.model.compression) {
        sql = 'TO_BASE64('+sql+') as '+this.quoteName(column)
    }
    // return column sql
    return sql
}