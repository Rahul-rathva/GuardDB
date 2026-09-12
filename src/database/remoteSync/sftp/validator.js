const sftpConfigKeys = {
    sftpHost: 'host',
    sftpPort: 'port',
    sftpAuthUser: 'username',
    sftpAuthPwd: 'password',
    sftpBackupPath: 'backupPath',
};

// ─────────────────────────────────────────────────────────────
// WHAT THIS FILE DOES:
// Validates SFTP specific fields in a config JSON file
// Called from remoteSync/validator.js when remoteType = SFTP
//
// Key mapping: user writes 'host', 'port', 'username' etc.
// App stores as: 'sftpHost', 'sftpPort', 'sftpAuthUser' etc.
// Different names each side — transformation happens here
// ─────────────────────────────────────────────────────────────

const validateInitConfig = async (config) => {
    const validatedConfig = {};

    // VALIDATE: host
    if (!config[sftpConfigKeys.sftpHost]) {
        throw new Error(
            `Invalid config: Missing required field - '${sftpConfigKeys.sftpHost}'`
        );
    }
    validatedConfig.sftpHost = config[sftpConfigKeys.sftpHost];

    // VALIDATE: port
    if (!config[sftpConfigKeys.sftpPort]) {
        throw new Error(
            `Invalid config: Missing required field - '${sftpConfigKeys.sftpPort}'`
        );
    }
    if (isNaN(config[sftpConfigKeys.sftpPort]) || Number(config[sftpConfigKeys.sftpPort]) === 0) {
        throw new Error(
            `Invalid config: Not a valid '${sftpConfigKeys.sftpPort}' - ${config[sftpConfigKeys.sftpPort]}`
        );
    }
    if (Number(config[sftpConfigKeys.sftpPort]) < 1 || Number(config[sftpConfigKeys.sftpPort]) > 65535) {
        throw new Error(
            `Invalid config: Port must be between 1 and 65535 - ${config[sftpConfigKeys.sftpPort]}`
        );
    }
    validatedConfig.sftpPort = config[sftpConfigKeys.sftpPort].toString();

    // VALIDATE: username
    if (!config[sftpConfigKeys.sftpAuthUser]) {
        throw new Error(
            `Invalid config: Missing required field - '${sftpConfigKeys.sftpAuthUser}'`
        );
    }
    validatedConfig.sftpAuthUser = config[sftpConfigKeys.sftpAuthUser];

    // VALIDATE: password
    if (!config[sftpConfigKeys.sftpAuthPwd]) {
        throw new Error(
            `Invalid config: Missing required field - '${sftpConfigKeys.sftpAuthPwd}'`
        );
    }
    validatedConfig.sftpAuthPwd = config[sftpConfigKeys.sftpAuthPwd];

    // VALIDATE: backupPath
    if (!config[sftpConfigKeys.sftpBackupPath]) {
        throw new Error(
            `Invalid config: Missing required field - '${sftpConfigKeys.sftpBackupPath}'`
        );
    }
    validatedConfig.sftpBackupPath = config[sftpConfigKeys.sftpBackupPath];
    // Note: cannot check if remote path EXISTS here
    // That check happens when sftp.exists() connects to server
    // Local validator has no access to remote filesystem

    return validatedConfig;
    // Returns: {
    //   sftpHost: 'backup.myserver.com',
    //   sftpPort: '22',
    //   sftpAuthUser: 'backupuser',
    //   sftpAuthPwd: 'secret123',
    //   sftpBackupPath: '/home/backups'
    // }
};

module.exports = {
    validateInitConfig,
};