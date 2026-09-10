const mysql = require('mysql');
const exec = require('./../../utils/await-exec');
const isGzip = require('./../../utils/isGzip');
const files = require('./../../utils/files');
const path = require('path');
const encryptionCheck = require('../../utils/isEncrypted');

// ─────────────────────────────────────────────────────────────
// PRIVATE HELPERS — Promisify callback-based mysql package
// Not exported — only used internally by connect()
// ─────────────────────────────────────────────────────────────

// Wraps mysql's callback-based connect() in a Promise
// Allows us to use await instead of nested callbacks
const awaitMysqlConnect = (connection) => {
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

// Wraps mysql's callback-based end() in a Promise
// Always close connections after use — prevents memory leaks
const awaitMysqlEnd = (connection) => {
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
// Tests if MySQL credentials are valid
// Called during: guarddb --config db (setup verification)
// Connects then immediately disconnects — only tests the connection
// ─────────────────────────────────────────────────────────────

const connect = async (dbConfig) => {
    const connection = mysql.createConnection({
        user: dbConfig.dbAuthUser,
        password: dbConfig.dbAuthPwd,
        host: dbConfig.dbHost,
        port: dbConfig.dbPort,
        database: dbConfig.dbName,
    });

    // Connect to verify credentials work
    const connRes = await awaitMysqlConnect(connection);

    // Immediately disconnect — we only needed to test
    await awaitMysqlEnd(connection);

    return connRes;
};

// ─────────────────────────────────────────────────────────────
// FUNCTION 2: dump()
// Creates a complete MySQL database backup
// Called during: scheduled daily backup AND guarddb --run
// Order: dump → compress (if enabled) → encrypt (if enabled)
// Compress BEFORE encrypt — encrypted data cannot be compressed
// ─────────────────────────────────────────────────────────────

const dump = async (dbConfig, key, backupPath) => {
    // Build mysqldump shell command
    // mysqldump = MySQL's official backup utility
    // --compress   = compress MySQL protocol traffic (not the file)
    // --routines   = include stored procedures in backup
    // --result-file = save output to this path
    const mysqlDumpCmd = `mysqldump \
    --host=${dbConfig.dbHost} \
    --port=${dbConfig.dbPort} \
    --user=${dbConfig.dbAuthUser} \
    --password=${dbConfig.dbAuthPwd} \
    --databases ${dbConfig.dbName} \
    --compress \
    --routines \
    --result-file=${backupPath}`;

    // Run the mysqldump command in terminal shell
    // await: waits for full backup file to be written
    const dbDump = await exec(mysqlDumpCmd);

    // STEP 2: Compress backup file if user enabled compression
    // SQL files compress extremely well (up to 90% size reduction)
    // because SQL text has lots of repetition
    if (dbConfig.dbIsCompressionEnabled) {
        await files.compressFile(backupPath);
    }

    // STEP 3: Encrypt backup file if user enabled encryption
    // Always encrypt AFTER compression for better results
    // Encrypted data looks random and cannot be compressed
    if (dbConfig.backupEncryptionEnabled) {
        await files.encrypt(backupPath, key);
    }

    return dbDump;
};

// ─────────────────────────────────────────────────────────────
// FUNCTION 3: restore()
// Restores MySQL database from a backup file
// Called during: guarddb --restore
// Reverses dump() order: decrypt → decompress → restore
// Uses finally block to ALWAYS clean up temp files
// even if restore fails halfway through
// ─────────────────────────────────────────────────────────────

const restore = async (dbConfig, key, backupFilename) => {
    // Build full path to backup file
    let backupFilePath = path.join(dbConfig.dbBackupPath, backupFilename);

    // Track temp filenames for cleanup in finally block
    let decryptFileName;

    // STEP 1: Decrypt if file was encrypted during dump
    // Check magic bytes in file header — more reliable than extension
    const isEncrypted = await encryptionCheck.isEncrypted(backupFilePath);
    if (isEncrypted) {
        // Decrypt creates a new file with _unenc suffix
        await files.decrypt(backupFilePath, key);
        backupFilePath = `${backupFilePath}_unenc`;
        decryptFileName = backupFilePath;
    }

    // STEP 2: Decompress if file was compressed during dump
    // Check GZIP magic bytes (0x1f 0x8b) — not file extension
    const isCompressed = isGzip(backupFilePath);
    if (isCompressed) {
        // Decompress creates a new .sql file
        await files.decompressFile(backupFilePath);
        backupFilePath = `${backupFilePath}.sql`;
    }

    // STEP 3: Run the actual MySQL restore
    // mysql command (NOT mysqldump) — imports SQL into database
    // < backupFilePath = redirect file contents into mysql
    // --protocol=TCP = force TCP connection (not Unix socket)
    // Note: -p has NO space before password (MySQL CLI convention)
    const mysqlRestoreCmd = `mysql \
    --host=${dbConfig.dbHost} \
    --port=${dbConfig.dbPort} \
    --protocol=TCP \
    -u ${dbConfig.dbAuthUser} \
    -p${dbConfig.dbAuthPwd} \
    ${dbConfig.dbName} \
    < ${backupFilePath}`;

    try {
        const dbRestore = await exec(mysqlRestoreCmd);
        return dbRestore;

    } finally {
        // ALWAYS runs — whether restore succeeded or failed
        // Critical: clean up temp files left from decrypt/decompress
        // Leaving unencrypted files on disk defeats encryption purpose

        if (isCompressed) {
            // Delete temporary decompressed .sql file
            await files.deleteFile(backupFilePath);
        }

        if (isEncrypted) {
            // Delete temporary decrypted _unenc file
            // Security critical — remove unencrypted copy from disk
            await files.deleteFile(decryptFileName);
        }
    }
};

// ─────────────────────────────────────────────────────────────
// EXPORTS
// Only public interface exported — helpers stay private
// ─────────────────────────────────────────────────────────────

module.exports = {
    connect,
    dump,
    restore,
};