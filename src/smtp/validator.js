const utils = require('./../utils/utils');

// ─────────────────────────────────────────────────────────────
// WHAT THIS FILE DOES:
// Validates SMTP config loaded from a JSON file (--file flag)
// Called from smtp.js setupConfig() when filePath is provided
//
// Key mapping: user writes 'host', 'port', 'username' etc.
// App stores as: 'smtpHost', 'smtpPort', 'smtpUser' etc.
// ─────────────────────────────────────────────────────────────

const smtpConfigKeys = {
    smtpHost: 'host',
    smtpPort: 'port',
    smtpUser: 'username',
    smtpPwd: 'password',
    smtpSenderMail: 'senderMail',
    smtpRecipientMail: 'recipientMail',
    smtpNotifyTime: 'notificationTime',
};

const validateInitConfig = async (config) => {
    const validatedConfig = {};

    // VALIDATE: host
    if (!config[smtpConfigKeys.smtpHost]) {
        throw new Error(
            `Invalid config: Missing required field - '${smtpConfigKeys.smtpHost}'`
        );
    }
    validatedConfig.smtpHost = config[smtpConfigKeys.smtpHost];

    // VALIDATE: port
    if (!config[smtpConfigKeys.smtpPort]) {
        throw new Error(
            `Invalid config: Missing required field - '${smtpConfigKeys.smtpPort}'`
        );
    }
    if (isNaN(config[smtpConfigKeys.smtpPort]) || Number(config[smtpConfigKeys.smtpPort]) === 0) {
        throw new Error(
            `Invalid config: Not a valid '${smtpConfigKeys.smtpPort}' - ${config[smtpConfigKeys.smtpPort]}`
        );
    }
    // Validate SMTP port is one of the allowed values
    if (![25, 465, 587].includes(Number(config[smtpConfigKeys.smtpPort]))) {
        throw new Error(
            `Invalid config: SMTP port must be 25, 465, or 587 - got ${config[smtpConfigKeys.smtpPort]}`
        );
    }
    validatedConfig.smtpPort = config[smtpConfigKeys.smtpPort].toString();

    // VALIDATE: username
    if (!config[smtpConfigKeys.smtpUser]) {
        throw new Error(
            `Invalid config: Missing required field - '${smtpConfigKeys.smtpUser}'`
        );
    }
    validatedConfig.smtpUser = config[smtpConfigKeys.smtpUser];

    // VALIDATE: password
    if (!config[smtpConfigKeys.smtpPwd]) {
        throw new Error(
            `Invalid config: Missing required field - '${smtpConfigKeys.smtpPwd}'`
        );
    }
    validatedConfig.smtpPwd = config[smtpConfigKeys.smtpPwd];

    // VALIDATE: senderMail (existence + format)
    if (!config[smtpConfigKeys.smtpSenderMail]) {
        throw new Error(
            `Invalid config: Missing required field - '${smtpConfigKeys.smtpSenderMail}'`
        );
    }
    if (!utils.validateEmail(config[smtpConfigKeys.smtpSenderMail])) {
        throw new Error(
            `Invalid config: Invalid email - ${config[smtpConfigKeys.smtpSenderMail]}`
        );
    }
    validatedConfig.smtpSenderMail = config[smtpConfigKeys.smtpSenderMail];

    // VALIDATE: recipientMail (existence + format)
    if (!config[smtpConfigKeys.smtpRecipientMail]) {
        throw new Error(
            `Invalid config: Missing required field - '${smtpConfigKeys.smtpRecipientMail}'`
        );
    }
    if (!utils.validateEmail(config[smtpConfigKeys.smtpRecipientMail])) {
        throw new Error(
            `Invalid config: Invalid email - ${config[smtpConfigKeys.smtpRecipientMail]}`
        );
    }
    validatedConfig.smtpRecipientMail = config[smtpConfigKeys.smtpRecipientMail];

    // VALIDATE: notificationTime (existence + format HH:MM)
    if (!config[smtpConfigKeys.smtpNotifyTime]) {
        throw new Error(
            `Invalid config: Missing required field - '${smtpConfigKeys.smtpNotifyTime}'`
        );
    }

    // Check colon separator exists
    if (config[smtpConfigKeys.smtpNotifyTime].indexOf(':') === -1) {
        throw new Error(
            `Invalid config: Invalid ${smtpConfigKeys.smtpNotifyTime} - '${config[smtpConfigKeys.smtpNotifyTime]}'`
        );
    }

    // Split and validate each part
    const notifyTime = config[smtpConfigKeys.smtpNotifyTime].split(':');
    const notifyTimeHours = notifyTime[0];
    const notifyTimeMinutes = notifyTime[1];

    if (
        notifyTimeHours.length === 0 ||
        notifyTimeMinutes.length === 0 ||
        notifyTimeHours.length > 2 ||
        notifyTimeMinutes.length > 2
    ) {
        throw new Error(
            `Invalid config: Invalid ${smtpConfigKeys.smtpNotifyTime} - '${config[smtpConfigKeys.smtpNotifyTime]}'`
        );
    }

    // Validate time range: hours 0-23, minutes 0-59
    if (
        Number(notifyTimeHours) < 0 ||
        Number(notifyTimeHours) > 23 ||
        Number(notifyTimeMinutes) < 0 ||
        Number(notifyTimeMinutes) > 59
    ) {
        throw new Error(
            `Invalid config: Invalid ${smtpConfigKeys.smtpNotifyTime} - '${config[smtpConfigKeys.smtpNotifyTime]}'`
        );
        // ⚠️ ORIGINAL BUG: compared strings not numbers
        // notifyTimeHours > 23 where notifyTimeHours is a string
        // Fixed: Number(notifyTimeHours) > 23
    }

    validatedConfig.smtpNotifyTime = new Date(1970, 1, 1, notifyTimeHours, notifyTimeMinutes);
    // Convert time string to Date object
    // Same pattern as database/validator.js backupTime conversion
    // Only hours and minutes matter — date is irrelevant

    return validatedConfig;
};

module.exports = {
    validateInitConfig,
};