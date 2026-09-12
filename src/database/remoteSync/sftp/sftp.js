const client = require('ssh2-sftp-client');
const configstore = require('conf');
const path = require('path');

// ─────────────────────────────────────────────────────────────
// WHAT THIS FILE DOES:
// SFTP specialist — handles all SFTP remote server operations
// SFTP = SSH File Transfer Protocol
// Transfers files securely over an SSH connection
// Used to backup to your OWN remote Linux/Unix server
//
// Pattern: connect → do operation → always disconnect (finally)
// Every function follows this same connect/operate/disconnect flow
// ─────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────
// FUNCTION 1: init()
// Builds SFTP connection config object from stored settings
// NOT async — just builds a plain config object
// Does NOT actually connect — just prepares connection params
// ─────────────────────────────────────────────────────────────

const init = (jobName, key, sftpConfig = undefined) => {
    const jobConfStore = new configstore({configName: jobName, encryptionKey: key});

    if (!sftpConfig) {
        sftpConfig = jobConfStore.store;
        // No config passed — load from saved encrypted config
        // Used during normal backup/delete operations
    }

    // Build ssh2-sftp-client connection config object
    return {
        host: sftpConfig.sftpHost,
        // SFTP server hostname or IP address
        // e.g., '192.168.1.100' or 'backup.myserver.com'

        port: sftpConfig.sftpPort,
        // SFTP port — default SSH/SFTP port is 22
        // Some servers use custom ports for security

        username: sftpConfig.sftpAuthUser,
        // SSH username for authentication

        password: sftpConfig.sftpAuthPwd,
        // SSH password for authentication
        // Alternative: privateKey for SSH key-based auth
        // Industry term: "SSH key authentication" — more secure
        // than password auth for production servers
    };
};

// ─────────────────────────────────────────────────────────────
// FUNCTION 2: exists()
// Tests SFTP connection AND checks backup directory exists
// Called during: guarddb --config remote-sync (SFTP verification)
// Uses error variable pattern with finally for safe cleanup
// ─────────────────────────────────────────────────────────────

const exists = async (jobName, key, sftpConfig = undefined) => {
    const jobConfStore = new configstore({configName: jobName, encryptionKey: key});

    if (!sftpConfig) {
        sftpConfig = jobConfStore.store;
    }

    const config = init(jobName, key, sftpConfig);
    const sftp = new client();
    // Create new SFTP client instance
    // ssh2-sftp-client is Promise-based — no promisification needed
    // Unlike mysql/pg which needed manual Promise wrapping

    let existsRes;
    let error;
    // Error variable pattern:
    // Store errors instead of throwing immediately
    // Lets finally block run before throwing
    // Industry term: "Deferred error handling"

    try {
        await sftp.connect(config);
        // Connect to SFTP server
        // Throws if: wrong host, wrong port, wrong credentials
        // await: waits for SSH handshake to complete

        existsRes = await sftp.exists(sftpConfig.sftpBackupPath);
        // Check if backup directory exists on remote server
        // Returns:
        //   false = path doesn't exist
        //   'd'   = path exists and is a directory ✓
        //   '-'   = path exists but is a file ✗
        //   'l'   = path exists and is a symlink

        if (!existsRes) {
            error = new Error(
                `Given directory '${sftpConfig.sftpBackupPath}' does not exist on the remote server`
            );
            // Directory doesn't exist — can't store backups there
        } else if (existsRes !== 'd') {
            error = new Error(
                `Not a directory, '${sftpConfig.sftpBackupPath}'`
            );
            // Path exists but is a file or symlink — not a directory
        }

    } catch (err) {
        error = err;
        // Catch connection errors or any other errors
        // Store in error variable — don't throw yet
        // Need finally to disconnect first

    } finally {
        await sftp.end();
        // ALWAYS disconnect — whether operation succeeded or failed
        // sftp.end() gracefully closes the SSH connection
        // Critical: unclosed SSH connections can cause issues
        // await: wait for clean disconnect before continuing
    }

    if (error) throw error;
    // NOW throw the error after connection is safely closed
    // This is the deferred error pattern in action

    return existsRes;
    // Returns 'd' if directory exists and is valid
    // remoteSync.js checks this result
};

// ─────────────────────────────────────────────────────────────
// FUNCTION 3: uploadFile()
// Uploads backup file to remote SFTP server
// Called from backup.js after every successful backup
// ─────────────────────────────────────────────────────────────

const uploadFile = async (jobName, key, srcFileName, srcFilePath) => {
    const jobConfStore = new configstore({configName: jobName, encryptionKey: key});
    const sftpConfig = jobConfStore.store;

    const config = init(jobName, key, sftpConfig);
    const sftp = new client();

    let uploadRes;
    let error;

    try {
        await sftp.connect(config);

        const remoteFilePath = path.join(sftpConfig.sftpBackupPath, srcFileName)
            .replace(/\\/g, '/');
        // Build remote file path:
        // sftpBackupPath = '/home/backups'
        // srcFileName    = 'master_backup_03-12-2026'
        // joined         = '/home/backups/master_backup_03-12-2026'
        //
        // .replace(/\\/g, '/')
        // Replaces ALL backslashes with forward slashes
        // Why? path.join on Windows uses \ (backslash)
        // SFTP servers run on Linux/Unix — need / (forward slash)
        // Regex: /\\/g = find all \ characters, replace with /
        // \\ = escaped backslash in regex
        // g  = global flag = replace ALL occurrences not just first
        // Industry term: "Path normalization" — converting OS paths
        // to universal format

        uploadRes = await sftp.put(srcFilePath, remoteFilePath);
        // sftp.put() = upload local file to remote path
        // srcFilePath    = local path to backup file
        // remoteFilePath = destination on SFTP server
        // Streams the file over SSH connection
        // await: waits for complete upload

    } catch (err) {
        error = err;
    } finally {
        await sftp.end();
        // Always disconnect
    }

    if (error) throw error;
    return uploadRes;
};

// ─────────────────────────────────────────────────────────────
// FUNCTION 4: deleteFile()
// Deletes old backup file from remote SFTP server
// Called from backup.js to clean old remote backups
// ─────────────────────────────────────────────────────────────

const deleteFile = async (jobName, key, fileName) => {
    const jobConfStore = new configstore({configName: jobName, encryptionKey: key});
    const sftpConfig = jobConfStore.store;

    const config = init(jobName, key, sftpConfig);
    const sftp = new client();

    let deleteRes;
    let error;

    try {
        await sftp.connect(config);

        const remoteFilePath = path.join(sftpConfig.sftpBackupPath, fileName)
            .replace(/\\/g, '/');
        // Same path building + Windows path fix as uploadFile

        deleteRes = await sftp.delete(remoteFilePath);
        // sftp.delete() = remove file from remote server
        // Permanent deletion — no trash/recycle bin on SFTP
        // await: waits for deletion confirmation

    } catch (err) {
        error = err;
    } finally {
        await sftp.end();
        // Always disconnect
    }

    if (error) throw error;
    return deleteRes;
};

module.exports = {
    exists,
    uploadFile,
    deleteFile,
    // init NOT exported in corrected version
    // init is an internal helper — external code shouldn't need it
};