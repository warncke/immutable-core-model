'use strict'

/* app modules */
const ImmutableCoreModel = require('../../lib/immutable-core-model.js')

/* exports */
module.exports = mysql

const dbHost = process.env.DB_HOST || 'localhost'
const dbName = process.env.DB_NAME || 'test'
const dbPass = process.env.DB_PASS || 'test'
const dbUser = process.env.DB_USER || 'test'

const connectionParams = {
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
    const mysql = await ImmutableCoreModel.createMysqlConnection(connectionParams)
    await mysql.query(`DROP DATABASE IF EXISTS ${dbName}`)
    await mysql.query(`CREATE DATABASE ${dbName}`)
    await mysql.query(`USE ${dbName}`)
    return mysql
}