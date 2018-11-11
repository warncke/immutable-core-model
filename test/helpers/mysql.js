'use strict'

/* app modules */
const ImmutableCoreModel = require('../../lib/immutable-core-model.js')

/* exports */
module.exports = mysql

const dbHost = process.env.DB_HOST || 'localhost'
const dbName = process.env.DB_NAME || 'test'
const dbPass = process.env.DB_PASS || ''
const dbUser = process.env.DB_USER || 'root'

const connectionParams = {
    database: dbName,
    host: dbHost,
    password: dbPass,
    user: dbUser,
}

/**
 * @function mysql
 *
 * return new mysql connection
 *
 * @returns {Promise<Connection>}
 */
async function mysql () {
    return ImmutableCoreModel.createMysqlConnection(connectionParams)
}