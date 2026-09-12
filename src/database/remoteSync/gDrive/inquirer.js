const inquirer = require('inquirer');
const files = require('../../utils/files');
const configstore = require('conf');

// ─────────────────────────────────────────────────────────────
// WHAT THIS FILE DOES:
// Google Drive specific setup prompts
// Called from remoteSync/inquirer.js after user picks Google Drive
//
// Two functions:
// askConfig()     → asks for service account key file path
// askRemoteLoc()  → asks which Drive folder to backup into
// ─────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────
// FUNCTION 1: askConfig()
// Asks for path to Google Service Account JSON key file
// ─────────────────────────────────────────────────────────────

const askConfig = async (jobName, key) => {
    const jobConfStore = new configstore({configName: jobName, encryptionKey: key});
    const jobConfigObj = jobConfStore.store;
    // Load existing config for pre-filling default path
    // If reconfiguring: shows previously used key file path

    const questions = [];

    questions.push({
        name: 'gDriveServiceAccKeyLoc',
        type: 'input',
        message: 'Enter the absolute path of the service account key file:',
        default: jobConfigObj.gDriveServiceAccKeyLoc,
        // Pre-fill with previously saved path if reconfiguring

        validate: (value) => {
            if (!value.length) {
                return 'Please enter the absolute path of the service account key file.';
            }
            if (!files.directoryExists(value)) {
                return `No such file, '${value}'`;
                // ⚠️ ORIGINAL: 'No Such file' — inconsistent capitalization
                // Fixed: 'No such file' — consistent with other validators
            }
            const isFile = files.isFile(value);
            if (!isFile) {
                return `'${value}' is a directory.`;
                // Service account key must be a FILE not a folder
                // User might accidentally provide a folder path
            }
            return true;
            // Both checks passed:
            // 1. Path exists on disk ✓
            // 2. Path is a file not directory ✓
        },
    });

    const gdConfig = await inquirer.prompt(questions);
    return gdConfig;
    // Returns: { gDriveServiceAccKeyLoc: '/home/user/key.json' }
    // Goes back to remoteSync/inquirer.js
    // Which merges it with { remoteType: 'Google Drive' }
};

// ─────────────────────────────────────────────────────────────
// FUNCTION 2: askRemoteLoc()
// Shows list of Google Drive folders to pick backup destination
// Called from remoteSync.js AFTER listFolders() fetches the list
// ─────────────────────────────────────────────────────────────

const askRemoteLoc = async (folders) => {
    // folders = already transformed array from remoteSync.js:
    // [{ name: 'Backups', value: '1abc234' },
    //  { name: 'My Drive', value: '5def678' }]
    // name = displayed to user, value = folder ID submitted

    const retObj = await inquirer.prompt({
        type: 'list',
        name: 'gDriveParentFolderId',
        // Stores the FOLDER ID not the name
        // This ID is used when uploading files (parents array)

        message: 'Choose the remote folder in which backups will be stored:',
        choices: folders,
        default: 0,
        // Default: first folder in the list (index 0)

        pageSize: 4,
        // Show 4 folders at a time in the terminal list
        // If more than 4 folders: user can scroll
        // Industry term: "Pagination" in terminal UI
    });

    return retObj;
    // Returns: { gDriveParentFolderId: '1abc234' }
    // Goes back to remoteSync.js setupConfig()
    // Which merges it into the full config and saves
};

module.exports = {
    askConfig,
    askRemoteLoc,
};