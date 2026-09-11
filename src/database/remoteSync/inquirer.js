const inquirer = require('inquirer');
const files = require('../utils/files');
const configstore = require('conf');
const gDriveInquirer = require('./gDrive/inquirer');
const sftpInquirer = require('./sftp/inquirer');
const s3Inquirer = require('./s3/inquirer');

// ─────────────────────────────────────────────────────────────
// WHAT THIS FILE DOES IN SIMPLE WORDS:
//
// This is the FIRST question in remote sync setup:
// "Which cloud provider do you want to use?"
//
// After user picks one, it hands off to that provider's
// own inquirer for the detailed questions:
//
// User picks Google Drive → gDriveInquirer.askConfig()
// User picks SFTP         → sftpInquirer.askConfig()
// User picks S3           → s3Inquirer.askConfig()
//
// Think of it as a RECEPTION DESK that greets you
// then sends you to the right specialist's office
//
// PATTERN: Same as database/inquirer.js but for cloud storage
// database/inquirer.js → asks which DB type then DB details
// remoteSync/inquirer.js → asks which cloud then cloud details
// ─────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────
// IMPORTS
// ─────────────────────────────────────────────────────────────

// npm inquirer package — interactive terminal prompts
const inquirer = require('inquirer');

// files utility — NOT used in this file
// ⚠️ UNUSED IMPORT: files is required but never called
// Should be removed — dead code increases bundle size
// and confuses future developers
const files = require('../utils/files');

// Encrypted config storage
// Used to read existing remoteType for pre-filling default
const configstore = require('conf');

// Each provider's own detailed setup questions
const gDriveInquirer = require('./gDrive/inquirer');
// Asks: Service account key path, which folder etc.

const sftpInquirer = require('./sftp/inquirer');
// Asks: Host, port, username, password, remote path etc.

const s3Inquirer = require('./s3/inquirer');
// Asks: AWS access key, secret key, region etc.

// ─────────────────────────────────────────────────────────────
// FUNCTION: askConfig(jobName, key)
// Step 1 of remote sync setup — pick a provider
// Step 2 — hands off to provider-specific inquirer
// Called from: remoteSync.js setupConfig()
// ─────────────────────────────────────────────────────────────

const askConfig = async (jobName, key) => {
    const jobConfStore = new configstore({configName: jobName, encryptionKey: key});
    const jobConfigObj = jobConfStore.store;
    // Load existing config for pre-filling defaults
    // If reconfiguring: jobConfigObj.remoteType = 'Google Drive'
    // Shows previously selected provider as default

    const questions = [];

    // QUESTION 1: Which cloud provider?
    questions.push({
        type: 'list',
        name: 'remoteType',
        message: 'Choose the remote service:',
        choices: ['Google Drive', 'SFTP', 'S3'],
        // These MUST match exactly what remoteSync.js checks:
        //   if (remoteType === 'Google Drive')
        //   if (remoteType === 'SFTP')
        //   if (remoteType === 'S3')
        // Case sensitive — 'google drive' would break routing

        default: jobConfigObj.remoteType || 'Google Drive',
        // If reconfiguring: pre-select previously chosen provider
        // If first time: default to Google Drive
    });

    // Ask ONLY the provider selection question first
    // Provider-specific questions come AFTER based on selection
    let retObj = await inquirer.prompt(questions);
    // retObj = { remoteType: 'Google Drive' | 'SFTP' | 'S3' }

    // ── ROUTE TO PROVIDER-SPECIFIC QUESTIONS ──

    if (retObj.remoteType == 'Google Drive') {
    // ⚠️ == instead of ===

        let gdConfig = await gDriveInquirer.askConfig(jobName, key);
        // Shows Google Drive specific questions:
        // ? Path to Google Service Account key file:
        // Returns: { gDriveServiceAccKeyLoc: '/path/to/key.json' }

        retObj = Object.assign(retObj, gdConfig);
        // Merge provider selection WITH provider config:
        // Before: { remoteType: 'Google Drive' }
        // gdConfig: { gDriveServiceAccKeyLoc: '/path/key.json' }
        // After:  { remoteType: 'Google Drive',
        //           gDriveServiceAccKeyLoc: '/path/key.json' }

    } else if (retObj.remoteType == 'SFTP') {
    // ⚠️ == instead of ===

        let sftpConfig = await sftpInquirer.askConfig(jobName, key);
        // Shows SFTP specific questions:
        // ? SFTP Host:
        // ? SFTP Port: (22)
        // ? SFTP Username:
        // ? SFTP Password:
        // ? Remote backup directory:
        // Returns: { sftpHost, sftpPort, sftpUser, sftpPwd, sftpPath }

        retObj = Object.assign(retObj, sftpConfig);
        // Merge: { remoteType: 'SFTP', sftpHost, sftpPort... }

    } else if (retObj.remoteType == 'S3') {
    // ⚠️ == instead of ===

        let s3Config = await s3Inquirer.askConfig(jobName, key);
        // Shows S3 specific questions:
        // ? Path to AWS credentials file:
        // ? AWS Region: (us-east-1)
        // Returns: { s3AccKeyLoc, s3Region }

        retObj = Object.assign(retObj, s3Config);
        // Merge: { remoteType: 'S3', s3AccKeyLoc, s3Region }
    }
    // ⚠️ No else clause
    // Unknown remoteType → retObj only has remoteType
    // Missing provider config → will fail during actual use

    return retObj;
    // Returns complete config with:
    // remoteType + all provider-specific fields combined
    // Goes back to remoteSync.js setupConfig()
    // Which then tests the connection and saves everything
};

module.exports = {
    askConfig,
    // Only askConfig exported
    // No askRestoreConfig here — remote sync doesn't need restore prompts
    // Restore happens locally then re-uploads — no remote restore UI
};