const files = require('./../../utils/files');

// ─────────────────────────────────────────────────────────────
// WHAT THIS FILE DOES:
// Validates S3 specific fields in a config JSON file
// Called from remoteSync/validator.js when remoteType = S3
//
// Key mapping:
// User writes: 's3CredentialsFilePath' in JSON file
// App stores as: 's3AccKeyLoc' internally
// ─────────────────────────────────────────────────────────────

const s3ConfigKeys = {
    s3AccKeyLoc: 's3CredentialsFilePath',
    // User-facing name: 's3CredentialsFilePath' (descriptive)
    // Internal name:    's3AccKeyLoc' (shorter)
    // Same pattern as database validator (databaseType → dbType)
};

const validateInitConfig = async (config) => {
    const validatedConfig = {};

    // VALIDATE: s3CredentialsFilePath (stored as s3AccKeyLoc)
    if (!config[s3ConfigKeys.s3AccKeyLoc]) {
        throw new Error(
            `Invalid config: Missing required field - '${s3ConfigKeys.s3AccKeyLoc}'`
        );
    }

    // Check credentials file exists on disk
    if (!files.directoryExists(config[s3ConfigKeys.s3AccKeyLoc])) {
        throw new Error(
            `Invalid config: No such file, '${config[s3ConfigKeys.s3AccKeyLoc]}'`
        );
    }

    // Check it is a file not a directory
    const isFile = files.isFile(config[s3ConfigKeys.s3AccKeyLoc]);
    if (!isFile) {
        throw new Error(
            `Invalid config: '${config[s3ConfigKeys.s3AccKeyLoc]}' is a directory.`
        );
    }

    validatedConfig.s3AccKeyLoc = config[s3ConfigKeys.s3AccKeyLoc];
    // Transform: 's3CredentialsFilePath' (user) → 's3AccKeyLoc' (internal)

    return validatedConfig;
    // Returns: { s3AccKeyLoc: '/home/user/.aws/credentials.json' }
    // Goes back to remoteSync/validator.js
    // Which merges with { remoteType: 'S3' }
};

module.exports = {
    validateInitConfig,
};