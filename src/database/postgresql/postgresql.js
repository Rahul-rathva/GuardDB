const { Client } = require('pg');
const exec = require('./../../utils/await-exec');
const isGzip = require('./../../utils/isGzip');
const files = require('./../../utils/files');
const path = require('path');
const encryptionCheck = require('../../utils/isEncrypted');

// ─────────────────────────────────────────────────────────────
// KEY DIFFERENCES FROM MYSQL AND MONGODB:
//
// 1. Uses 'pg' package (node-postgres) — PostgreSQL's Node.js driver
//    Similar to mysql package — callback based, needs promisifying
//    Uses Client class (destructured) instead of whole package
//
// 2. dump() uses pg_dump with a full URI in --dbname flag
//    Unlike MySQL (separate flags) and MongoDB (separate flags)
//    PostgreSQL bundles everything into one URI:
//    postgresql://user:pass@host:port/database
//
// 3. restore() uses pg_restore (not psql like some PostgreSQL guides)
//    pg_restore works with custom format (-F c) backups
//    --clean flag = drops existing objects before restoring
//    Similar to MongoDB's --drop flag
//
// 4. Same promisification pattern as MySQL
//    Both mysql and pg packages use old callback style
//    Both need Promise wrappers for async/await
// ─────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────
// PRIVATE HELPERS — Promisify callback-based pg Client
// Same pattern as mysql.js awaitMysqlConnect/End
// pg package uses callbacks — we wrap in Promises
// ─────────────────────────────────────────────────────────────

// Wraps pg Client's callback-based connect() in a Promise
const awaitPostgresqlConnect = (connection) => {
    return new Promise((resolve, reject) => {
        connection.connect(function (err) {
            if (err) {
                reject(err);
                return;
            }
            resolve(connection);
        });
    });
};

// Wraps pg Client's callback-based end() in a Promise
// Always close connections after use — prevents connection pool exhaustion
const awaitPostgresqlEnd = (connection) => {
    return new Promise((resolve, reject) => {
        connection.end(function (err) {
            if (err) {
                reject(err);
                return;
            }
            resolve(connection);
        });
    });
};

// ─────────────────────────────────────────────────────────────
// FUNCTION 1: connect()
// Tests if PostgreSQL credentials are valid
// Called during: guarddb --config db (setup verification)
//
// KEY DIFFERENCE FROM MONGODB:
// MongoDB used mongoose.connect() with a URI string
// PostgreSQL uses new Client({}) with separate params
// Same concept, different library API style
// ─────────────────────────────────────────────────────────────

const connect = async (dbConfig) => {
    // Create a new PostgreSQL client with connection config
    // { Client } destructured from 'pg' package
    // Client = a single database connection
    // pg also has Pool = multiple connections managed automatically
    // We use Client here — single connection just for testing
    // Industry term: "Connection pool" vs "Single connection"
    const connection = new Client({
        user: dbConfig.dbAuthUser,
        password: dbConfig.dbAuthPwd,
        host: dbConfig.dbHost,
        port: dbConfig.dbPort,       // PostgreSQL default: 5432
        database: dbConfig.dbName,
    });

    // Connect to verify credentials work
    // If wrong credentials/host/port → throws here
    // Error propagates to database.js setupConfig()
    const connRes = await awaitPostgresqlConnect(connection);

    // Immediately disconnect — only needed connection test
    // PostgreSQL connections are expensive — always close when done
    await awaitPostgresqlEnd(connection);

    return connRes;
};

// ─────────────────────────────────────────────────────────────
// FUNCTION 2: dump()
// Creates a complete PostgreSQL database backup
// Called during: scheduled daily backup AND guarddb --run
//
// KEY DIFFERENCE FROM MYSQL:
// MySQL:      separate flags: --host= --port= --user= --password=
// PostgreSQL: one URI string: postgresql://user:pass@host:port/db
//
// KEY DIFFERENCE FROM MONGODB:
// MongoDB: --gzip flag handles compression internally
// PostgreSQL: --compress=0..9 in pg_dump, then separate compressFile()
//
// pg_dump uses custom format (-F c / --format=c)
// Custom format = binary format only pg_restore can read
// Advantage: faster restore, supports parallel restore
// Alternative: plain SQL format (like MySQL) readable by psql
// ─────────────────────────────────────────────────────────────

const dump = async (dbConfig, key, backupPath) => {
    // Build pg_dump command with URI connection string
    // pg_dump = PostgreSQL's official backup utility
    //
    // --dbname=postgresql://user:pass@host:port/db
    //   Full connection URI — PostgreSQL standard format
    //   Bundles all connection info into one argument
    //
    // --compress=0..9
    //   ⚠️ BUG: '0..9' is NOT valid pg_dump syntax
    //   Should be a single number: --compress=6
    //   0 = no compression, 9 = maximum compression
    //   6 = good balance of speed and size (default)
    //   '0..9' would cause pg_dump to fail with invalid argument
    //   Fix: use dbConfig.dbIsCompressionEnabled ? '--compress=6' : '--compress=0'
    //
    // --format=c
    //   c = custom format (binary, pg_restore compatible)
    //   Other formats:
    //   p = plain SQL text (like MySQL dump)
    //   d = directory format (multiple files)
    //   t = tar format
    //
    // > ${backupPath}
    //   Redirect output to file
    //   > = write stdout to file
    //   Same shell redirect as MySQL restore uses 
    //   But here it's > (writing output) not < (reading input)
    const postgresqlDumpCmd = `pg_dump \
    --dbname=postgresql://${dbConfig.dbAuthUser}:${dbConfig.dbAuthPwd}@${dbConfig.dbHost}:${dbConfig.dbPort}/${dbConfig.dbName} \
    --compress=6 \
    --format=c \
    > ${backupPath}`;

    // Run pg_dump command in terminal shell
    // await: waits for complete backup file to be written
    const dbDump = await exec(postgresqlDumpCmd);

    // Compress backup file if user enabled compression
    // Note: pg_dump already does some internal compression with --format=c
    // This is an ADDITIONAL gzip compression layer on top
    // May not reduce size much since pg_dump already compressed
    if (dbConfig.dbIsCompressionEnabled) {
        await files.compressFile(backupPath);
    }

    // Encrypt backup file if user enabled encryption
    // Always after compression — encrypted data can't be compressed
    if (dbConfig.backupEncryptionEnabled) {
        await files.encrypt(backupPath, key);
    }

    return dbDump;
};

// ─────────────────────────────────────────────────────────────
// FUNCTION 3: restore()
// Restores PostgreSQL database from a backup file
// Called during: guarddb --restore
//
// KEY DIFFERENCE FROM MONGODB:
// MongoDB used --archive= flag to specify input file
// PostgreSQL uses < redirect operator (like MySQL)
//
// KEY DIFFERENCE FROM MYSQL:
// MySQL used 'mysql' command to run SQL statements
// PostgreSQL uses 'pg_restore' which reads custom format
// pg_restore --clean = drops existing objects before restoring
// (equivalent to MongoDB's --drop flag)
// ─────────────────────────────────────────────────────────────

const restore = async (dbConfig, key, backupFilename) => {
    // Build full path to backup file
    let backupFilePath = path.join(dbConfig.dbBackupPath, backupFilename);

    // Track decrypted filename for cleanup in finally block
    let decryptFileName;

    // STEP 1: Decrypt if file was encrypted during dump
    const isEncrypted = await encryptionCheck.isEncrypted(backupFilePath);
    if (isEncrypted) {
        await files.decrypt(backupFilePath, key);
        backupFilePath = `${backupFilePath}_unenc`;
        decryptFileName = backupFilePath;
    }

    // STEP 2: Decompress if file was gzip compressed
    // isGzip reads magic bytes — reliable regardless of extension
    const isCompressed = isGzip(backupFilePath);
    if (isCompressed) {
        await files.decompressFile(backupFilePath);
        backupFilePath = `${backupFilePath}.sql`;
    }

    // STEP 3: Build pg_restore command
    // pg_restore = PostgreSQL's restore utility for custom format backups
    // Works specifically with --format=c (custom format) from pg_dump
    //
    // --dbname=postgresql://...
    //   Same URI format as pg_dump — consistent PostgreSQL style
    //
    // --clean
    //   Drops existing database objects before recreating them
    //   Ensures clean restore — equivalent to MongoDB's --drop
    //   Without --clean: might get errors if objects already exist
    //
    // < ${backupFilePath}
    //   Feed backup file into pg_restore via stdin redirect
    //   Same shell redirect pattern as MySQL restore
    const postgresqlRestoreCmd = `pg_restore \
    --dbname=postgresql://${dbConfig.dbAuthUser}:${dbConfig.dbAuthPwd}@${dbConfig.dbHost}:${dbConfig.dbPort}/${dbConfig.dbName} \
    --clean \
    < ${backupFilePath}`;

    try {
        const dbRestore = await exec(postgresqlRestoreCmd);
        return dbRestore;

    } finally {
        // ALWAYS runs — whether restore succeeded or failed
        // Clean up temporary files created during decrypt/decompress
        // Security critical — remove unencrypted copies from disk

        if (isCompressed) {
            // Delete temporary decompressed file
            await files.deleteFile(backupFilePath);
        }

        if (isEncrypted) {
            // Delete temporary decrypted _unenc file
            await files.deleteFile(decryptFileName);
        }
    }
};

// ─────────────────────────────────────────────────────────────
// EXPORTS
// Same interface as mysql.js and mongoDb.js: connect, dump, restore
// database.js routes to any of these three identically
// Industry term: "Consistent interface" / "Strategy Pattern"
// ─────────────────────────────────────────────────────────────

module.exports = {
    connect,
    dump,
    restore,
};