const mongoose = require('mongoose');
const mongoUriBuilder = require('./mongoUriBuilder');
const exec = require('./../../utils/await-exec');
const isGzip = require('./../../utils/isGzip');
const path = require('path');
const files = require('../../utils/files');
const encryptionCheck = require('../../utils/isEncrypted');

// ─────────────────────────────────────────────────────────────
// KEY DIFFERENCE FROM MYSQL:
// MongoDB uses Mongoose (high-level ODM library) for connect()
// But uses mongodump/mongorestore CLI tools for dump/restore
// MySQL used the mysql package for connect() — lower level
// MongoDB also uses a URI connection string instead of separate params
//
// NEW CONCEPT — mongoUriBuilder:
// Builds a MongoDB connection URI string
// Format: mongodb://username:password@host:port/database?authSource=admin
// MongoDB requires this specific URI format to connect
// Industry term: "Connection URI" / "Connection String"
// ─────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────
// FUNCTION 1: connect()
// Tests if MongoDB credentials are valid
// Called during: guarddb --config db (setup verification)
// Uses Mongoose — high level MongoDB library for Node.js
// Connects then immediately disconnects — only tests connection
// ─────────────────────────────────────────────────────────────

const connect = async (dbConfig) => {
    // Build MongoDB connection URI from individual config fields
    // Example output:
    // mongodb://root:secret@localhost:27017/mydb?authSource=admin
    const connectionUri = mongoUriBuilder({
        username: dbConfig.dbAuthUser,
        password: dbConfig.dbAuthPwd,
        host: dbConfig.dbHost,
        port: dbConfig.dbPort,
        database: dbConfig.dbName,
        options: {
            authSource: dbConfig.dbAuthSource,
            // authSource = which database holds the user credentials
            // Usually 'admin' for MongoDB
            // MongoDB-specific — MySQL and PostgreSQL don't need this
        },
    });

    // Connect using the URI string
    // useNewUrlParser: true    = use new URL parser (not deprecated one)
    // useUnifiedTopology: true = use new server discovery engine
    // Both options silence deprecation warnings in older Mongoose versions
    const connRes = await mongoose.connect(connectionUri, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
    });

    // Immediately close connection — only needed to verify credentials
    // mongoose.connection.close() vs mongoose.disconnect():
    // .close() = closes the underlying connection
    // .disconnect() = closes all connections in the pool
    // Either works here since we just opened one connection
    await mongoose.connection.close();

    return connRes;
};

// ─────────────────────────────────────────────────────────────
// FUNCTION 2: dump()
// Creates a complete MongoDB database backup
// Called during: scheduled daily backup AND guarddb --run
//
// KEY DIFFERENCE FROM MYSQL:
// MongoDB handles compression INTERNALLY via --gzip flag
// MySQL dumped first then compressed separately
// Here: mongodump compresses AS it creates the archive
// So: two different command builds (compressed vs not)
// Encryption still happens AFTER (same as MySQL)
// ─────────────────────────────────────────────────────────────

const dump = async (dbConfig, key, backupPath) => {
    let mongoDumpCmd;

    // Build mongodump command based on compression setting
    // mongodump = MongoDB's official backup utility
    // --archive = output as single archive file (not folder of files)
    // --gzip    = compress the archive (built into mongodump)
    //
    // KEY DIFFERENCE FROM MYSQL DUMP:
    // MySQL:   dump() then compressFile() separately
    // MongoDB: --gzip flag handles compression IN THE SAME COMMAND
    // Why? mongodump was designed with compression built in
    // mysqldump was not — needed external gzip tool
    if (dbConfig.dbIsCompressionEnabled) {
        // Compressed backup — uses mongodump's built-in gzip
        mongoDumpCmd = `mongodump \
        --db ${dbConfig.dbName} \
        --host ${dbConfig.dbHost} \
        --port ${dbConfig.dbPort} \
        --username ${dbConfig.dbAuthUser} \
        --password ${dbConfig.dbAuthPwd} \
        --authenticationDatabase ${dbConfig.dbAuthSource} \
        --gzip \
        --archive=${backupPath}`;
    } else {
        // Uncompressed backup — plain BSON archive
        // BSON = Binary JSON — MongoDB's native data format
        // Industry term: "BSON" — like JSON but binary encoded
        // Faster to read/write than text JSON
        mongoDumpCmd = `mongodump \
        --db ${dbConfig.dbName} \
        --host ${dbConfig.dbHost} \
        --port ${dbConfig.dbPort} \
        --username ${dbConfig.dbAuthUser} \
        --password ${dbConfig.dbAuthPwd} \
        --authenticationDatabase ${dbConfig.dbAuthSource} \
        --archive=${backupPath}`;
    }

    // Run mongodump command in terminal shell
    // await: waits for full backup archive to be written
    const dbDump = await exec(mongoDumpCmd);

    // Encrypt backup file if user enabled encryption
    // Done AFTER mongodump completes (including compression if enabled)
    // Compress then encrypt = correct order for best results
    if (dbConfig.backupEncryptionEnabled) {
        await files.encrypt(backupPath, key);
    }

    return dbDump;
};

// ─────────────────────────────────────────────────────────────
// FUNCTION 3: restore()
// Restores MongoDB database from a backup archive
// Called during: guarddb --restore
//
// KEY DIFFERENCE FROM MYSQL RESTORE:
// MongoDB uses --drop flag = drops existing collections first
// MySQL just re-runs the SQL (which includes DROP TABLE statements)
// --drop ensures clean restore even if extra collections exist
//
// MongoDB also uses --archive= to read from single file
// MySQL used < redirect operator to pipe file into mysql
// ─────────────────────────────────────────────────────────────

const restore = async (dbConfig, key, backupFilename) => {
    // Build full path to backup archive
    let backupFilePath = path.join(dbConfig.dbBackupPath, backupFilename);

    // STEP 1: Decrypt if file was encrypted during dump
    // Check file's magic bytes/header — not file extension
    const isEncrypted = await encryptionCheck.isEncrypted(backupFilePath);
    if (isEncrypted) {
        // Decrypt creates new file with _unenc suffix
        await files.decrypt(backupFilePath, key);
        backupFilePath = `${backupFilePath}_unenc`;
        // Note: decryptFileName not saved separately here
        // ⚠️ Unlike mysql.js — decryptFileName not tracked for cleanup
        // The finally block uses backupFilePath which was updated
    }

    // STEP 2: Check if archive is compressed
    // isGzip reads magic bytes — works whether encrypted or not
    // (after decryption, we can read the real bytes)
    const isCompressed = isGzip(backupFilePath);

    // STEP 3: Build mongorestore command based on compression
    // mongorestore = MongoDB's official restore utility
    // --drop    = drops existing collections before restoring
    //             Ensures clean restore — no duplicate data
    //             Industry term: "Destructive restore"
    // --gzip    = tells mongorestore the archive is gzip compressed
    //             MongoDB handles decompression internally
    //             (different from MySQL which needed separate decompress step)
    // --archive = read from single archive file (matches dump's --archive)
    let mongoRestoreCmd;
    if (isCompressed) {
        // Tell mongorestore to expect gzip compressed archive
        mongoRestoreCmd = `mongorestore \
        --host ${dbConfig.dbHost} \
        --port ${dbConfig.dbPort} \
        --username ${dbConfig.dbAuthUser} \
        --password ${dbConfig.dbAuthPwd} \
        --authenticationDatabase ${dbConfig.dbAuthSource} \
        --drop \
        --gzip \
        --archive=${backupFilePath}`;
    } else {
        // Plain BSON archive — no decompression needed
        mongoRestoreCmd = `mongorestore \
        --host ${dbConfig.dbHost} \
        --port ${dbConfig.dbPort} \
        --username ${dbConfig.dbAuthUser} \
        --password ${dbConfig.dbAuthPwd} \
        --authenticationDatabase ${dbConfig.dbAuthSource} \
        --drop \
        --archive=${backupFilePath}`;
    }

    try {
        const dbRestore = await exec(mongoRestoreCmd);
        return dbRestore;

    } finally {
        // ALWAYS runs — whether restore succeeded or failed
        // Clean up temporary decrypted file if we created one
        // Security critical — remove unencrypted copy from disk

        if (isEncrypted) {
            // Delete the temporary _unenc file
            await files.deleteFile(backupFilePath);
        }
        // Note: no compressed file cleanup needed here
        // MongoDB handles compression internally via --gzip flag
        // No separate decompressed temp file was created
        // This is cleaner than MySQL's restore which needed
        // to decompress to a separate file first
    }
};

// ─────────────────────────────────────────────────────────────
// EXPORTS
// Same interface as mysql.js: connect, dump, restore
// database.js can call either without knowing the difference
// Industry term: "Consistent interface" / "Polymorphism"
// ─────────────────────────────────────────────────────────────

module.exports = {
    connect,
    dump,
    restore,
};