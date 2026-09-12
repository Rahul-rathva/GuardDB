const files = require('../../utils/files');

// ─────────────────────────────────────────────────────────────
// WHAT THIS FILE DOES:
// Validates Google Drive specific fields in a config file
// Called from remoteSync/validator.js when remoteType = Google Drive
// Checks the service account key file path is valid
// ─────────────────────────────────────────────────────────────

const gDriveConfigKeys = {
    gDriveServiceAccKeyLoc: 'gDriveServiceAccKeyLoc',
    // User writes 'gDriveServiceAccKeyLoc' in JSON config file
    // App also stores it as 'gDriveServiceAccKeyLoc' internally
    // Same name both sides — no transformation needed
};

const validateInitConfig = async (config) => {
    const validatedConfig = {};

    // VALIDATE: gDriveServiceAccKeyLoc
    if (!config[gDriveConfigKeys.gDriveServiceAccKeyLoc]) {
        throw new Error(
            `Invalid config: Missing required field - '${gDriveConfigKeys.gDriveServiceAccKeyLoc}'`
        );
    }

    // Check the key file actually exists on disk
    if (!files.directoryExists(config[gDriveConfigKeys.gDriveServiceAccKeyLoc])) {
        throw new Error(
            `Invalid config: No such file, '${config[gDriveConfigKeys.gDriveServiceAccKeyLoc]}'`
        );
    }

    // Check it's a file not a directory
    const isFile = files.isFile(config[gDriveConfigKeys.gDriveServiceAccKeyLoc]);
    if (!isFile) {
        throw new Error(
            `Invalid config: '${config[gDriveConfigKeys.gDriveServiceAccKeyLoc]}' is a directory.`
        );
    }

    validatedConfig.gDriveServiceAccKeyLoc = config[gDriveConfigKeys.gDriveServiceAccKeyLoc];

    return validatedConfig;
    // Returns: { gDriveServiceAccKeyLoc: '/path/to/key.json' }
    // Goes back to remoteSync/validator.js
    // Which merges it with { remoteType: 'Google Drive' }
};

module.exports = {
    validateInitConfig,
};