'use strict'

/* npm modules */
const ImmutableDatabaseMariaSQL = require('immutable-database-mariasql')

/* exports */
module.exports = database

const dbHost = process.env.DB_HOST || 'localhost'
const dbName = process.env.DB_NAME || 'test'
const dbPass = process.env.DB_PASS || ''
const dbUser = process.env.DB_USER || 'root'

const connectionParams = {
    charset: 'utf8',
    db: dbName,
    host: dbHost,
    password: dbPass,
    user: dbUser,
}

/**
 * @function database
 *
 * return new database connection
 *
 * @returns {ImmutableDatabaseMariaSQL}
 */
function database () {
    return new ImmutableDatabaseMariaSQL(connectionParams)
}