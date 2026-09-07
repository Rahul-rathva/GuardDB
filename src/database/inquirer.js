const inquirer = require('inquirer');
const files = require('./../utils/files');
const configstore = require('conf');
const constants = require('../utils/constants');
const strings = require('./../utils/strings');

// Register custom datetime prompt ONCE at file level
// Not inside function — prevents re-registration on every call
inquirer.registerPrompt('datetime', require('inquirer-datepicker-prompt'));

const askConfig = async (jobName, key) => {
    const jobConfStore = new configstore({configName: jobName, encryptionKey: key});
    const jobConfigObj = jobConfStore.store;
    const questions = [];

    // QUESTION 1: Database Type Selection
    questions.push({
        type: 'list',
        name: 'dbType',
        message: 'Choose the type of database to backup',
        choices: ['MongoDB', 'MySQL', 'PostgreSQL'],
        default: jobConfigObj.dbType || 'MongoDB',
    });

    // QUESTION 2: Database Username
    questions.push({
        name: 'dbAuthUser',
        type: 'input',
        message: 'Enter your database username:',
        default: jobConfigObj.dbAuthUser,
        validate: (value) => {
            if (value.length) {
                return true;
            }
            return 'Please enter your database username.';
        },
    });

    // QUESTION 3: Database Password
    questions.push({
        name: 'dbAuthPwd',
        type: 'password',
        message: 'Enter your database password:',
        // No default — never pre-fill passwords (security risk)
        mask: '*',
        validate: (value) => {
            if (value.length) {
                return true;
            }
            return 'Please enter your database password.';
        },
    });

    // QUESTION 4: Database Host
    questions.push({
        name: 'dbHost',
        type: 'input',
        message: 'Enter the database hostname:',
        default: jobConfigObj.dbHost || 'localhost',
        validate: (value) => {
            if (value.length) {
                return true;
            }
            return 'Please enter the database hostname.';
        },
    });

    // QUESTION 5: Database Port (dynamic default based on DB type)
    questions.push({
        name: 'dbPort',
        type: 'input',
        message: 'Enter the database server port:',
        default: (ans) => {
            let defaultPort;
            if (ans.dbType === 'MongoDB') defaultPort = '27017';
            else if (ans.dbType === 'MySQL') defaultPort = '3306';
            else if (ans.dbType === 'PostgreSQL') defaultPort = '5432';
            return jobConfigObj.dbPort || defaultPort;
        },
        validate: (value) => {
            if (!value.length) {
                return 'Please enter the database server port.';
            }
            if (isNaN(value) || Number(value) === 0) {
                return strings.validNoWarning;
            }
            if (Number(value) < 1 || Number(value) > 65535) {
                return 'Port must be between 1 and 65535.';
            }
            return true;
        },
    });

    // QUESTION 6: Database Name
    questions.push({
        name: 'dbName',
        type: 'input',
        message: 'Enter the database name to backup:',
        default: jobConfigObj.dbName,
        validate: (value) => {
            if (value.length) {
                return true;
            }
            return 'Please enter your database name to be backed up.';
        },
    });

    // QUESTION 7: Auth Source (MongoDB ONLY — skipped for MySQL/PostgreSQL)
    questions.push({
        name: 'dbAuthSource',
        type: 'input',
        message: 'Enter the database name associated with the user credentials (i.e. authSource):',
        default: jobConfigObj.dbAuthSource || 'admin',
        validate: (value) => {
            if (value.length) {
                return true;
            }
            return 'Please enter the database name associated with the user credentials.';
        },
        when: (answers) => answers.dbType === 'MongoDB',
    });

    // QUESTION 8: Backup Storage Path (validated against real filesystem)
    questions.push({
        name: 'dbBackupPath',
        type: 'input',
        message: 'Enter the absolute path of the directory for storing local backups:',
        default: jobConfigObj.dbBackupPath,
        validate: (value) => {
            if (!value.length) {
                return 'Please enter the absolute path of the directory for storing local backups.';
            }
            if (!files.directoryExists(value)) {
                return `No such directory, '${value}'`;
            }
            if (files.isFile(value)) {
                return `'${value}' is a file.`;
            }
            return true;
        },
    });

    // QUESTION 9: Backup Encryption (only shown if cipher/key is set up)
    questions.push({
        type: 'confirm',
        name: 'backupEncryptionEnabled',
        message: 'Do you want the backup files to be encrypted?',
        default: false,
        when: () => {
            if (key) {
                return true;
            }
            return false;
        },
    });

    // QUESTION 10: Backup Compression
    questions.push({
        type: 'confirm',
        name: 'dbIsCompressionEnabled',
        message: 'Do you want to enable backup compression?',
        default: false,
    });

    // QUESTION 11: Backup Time (custom datetime picker)
    const dbBackupTimeString = jobConfigObj.dbBackupTime || '1970-01-01 00:00';
    questions.push({
        type: 'datetime',
        name: 'dbBackupTime',
        message: 'Enter the time to run the backups every day:',
        format: ['H', ':', 'MM', ' ', 'Z'],
        initial: new Date(dbBackupTimeString),
    });

    // QUESTION 12: Number of Daily Backups to Keep
    questions.push({
        name: 'dbNoOfDays',
        type: 'input',
        message: 'Enter the number of days to persist backups for (1 backup per day):',
        default: jobConfigObj.dbNoOfDays || '7',
        validate: (value) => {
            if (!value.length) {
                return 'Please enter the number of days to persist backups for.';
            }
            if (isNaN(value) || Number(value) === 0) {
                return strings.validNoWarning;
            }
            return true;
        },
    });

    // QUESTION 13: Number of Weekly Backups to Keep
    questions.push({
        name: 'dbNoOfWeeks',
        type: 'input',
        message: 'Enter the number of weeks to persist backups for (1 backup per week):',
        default: jobConfigObj.dbNoOfWeeks || '8',
        validate: (value) => {
            if (!value.length) {
                return 'Please enter the number of weeks to persist backups for.';
            }
            if (isNaN(value) || Number(value) === 0) {
                return strings.validNoWarning;
            }
            return true;
        },
    });

    // QUESTION 14: Number of Monthly Backups to Keep
    questions.push({
        name: 'dbNoOfMonths',
        type: 'input',
        message: 'Enter the number of months to persist backups for (1 backup per month):',
        default: jobConfigObj.dbNoOfMonths || '6',
        validate: (value) => {
            if (!value.length) {
                return 'Please enter the number of months to persist backups for.';
            }
            if (isNaN(value) || Number(value) === 0) {
                return strings.validNoWarning;
            }
            return true;
        },
    });

    // Collect all answers — no try/catch needed (errors bubble up naturally)
    const dbConfig = await inquirer.prompt(questions);
    return dbConfig;
};

const askRestoreConfig = async (jobName, key) => {
    const jobConfStore = new configstore({configName: jobName, encryptionKey: key});
    const jobConfigObj = jobConfStore.store;
    const questions = [];

    // Get all backup files from backup directory
    const fileList = await files.listFileNames(jobConfigObj.dbBackupPath);

    // Filter to only this job's backups then sort newest first
    const choices = getJobSpecificBackups(jobName, fileList).sort().reverse();

    // If no backups exist — throw proper Error object
    if (choices.length === 0) {
        throw new Error('No backups have been found in the backup directory.');
    }

    // QUESTION 1: Which backup to restore from
    questions.push({
        type: 'list',
        name: 'backupFileName',
        message: 'Choose the backup to restore:',
        choices: choices,
        default: choices[0],
    });

    // QUESTION 2: Final confirmation before destructive operation
    questions.push({
        type: 'confirm',
        name: 'restoreConfirmation',
        message: 'Restoring will completely overwrite the existing database. Are you sure you want to continue?',
        default: false, // MUST be false — this is a destructive action
    });

    const restoreConfig = await inquirer.prompt(questions);
    return restoreConfig;
};

// Private helper — filters backup list to only current job's backups
const getJobSpecificBackups = (jobName, fileList) => {
    const choices = [];
    for (const fileName of fileList) {
        const jobNameAutomatic = fileName.split(constants.DB_BACKUP_DIR_PREFIX);
        const jobNameManual = fileName.split(constants.DB_MANUAL_BACKUP_DIR_PREFIX);
        if (jobNameAutomatic[0] === jobName || jobNameManual[0] === jobName) {
            choices.push(fileName);
        }
    }
    return choices;
};

module.exports = {
    askConfig,
    askRestoreConfig,
};