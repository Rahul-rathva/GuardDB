const inquirer = require('inquirer');
const configstore = require('conf');
const gDriveInquirer = require('./gDrive/inquirer');
const sftpInquirer = require('./sftp/inquirer');
const s3Inquirer = require('./s3/inquirer');

// ─────────────────────────────────────────────────────────────
// WHAT THIS FILE DOES:
// Step 1 of remote sync setup — asks which cloud provider
// Step 2 — hands off to that provider's own inquirer
//
// Flow:
// User picks Google Drive → gDriveInquirer.askConfig()
// User picks SFTP         → sftpInquirer.askConfig()
// User picks S3           → s3Inquirer.askConfig()
// ─────────────────────────────────────────────────────────────

const askConfig = async (jobName, key) => {
    const jobConfStore = new configstore({configName: jobName, encryptionKey: key});
    const jobConfigObj = jobConfStore.store;
    // Load existing config to pre-fill default selection
    // If reconfiguring: shows previously chosen provider as default

    const questions = [];

    // QUESTION 1: Which cloud provider?
    // Choices MUST match exactly what remoteSync.js checks
    // Case sensitive — 'google drive' would break routing
    questions.push({
        type: 'list',
        name: 'remoteType',
        message: 'Choose the remote service:',
        choices: ['Google Drive', 'SFTP', 'S3'],
        default: jobConfigObj.remoteType || 'Google Drive',
    });

    // Ask provider selection first
    // Provider-specific questions come AFTER based on answer
    const providerAnswer = await inquirer.prompt(questions);
    // providerAnswer = { remoteType: 'Google Drive' | 'SFTP' | 'S3' }

    // ── ROUTE TO PROVIDER-SPECIFIC QUESTIONS ──
    // Each provider has its own detailed setup questions
    // Merge provider selection WITH provider-specific config

    if (providerAnswer.remoteType === 'Google Drive') {
        const gdConfig = await gDriveInquirer.askConfig(jobName, key);
        // Asks: Path to Google Service Account key file
        // Returns: { gDriveServiceAccKeyLoc: '/path/to/key.json' }

        return Object.assign(providerAnswer, gdConfig);
        // Result: { remoteType: 'Google Drive',
        //           gDriveServiceAccKeyLoc: '/path/key.json' }

    } else if (providerAnswer.remoteType === 'SFTP') {
        const sftpConfig = await sftpInquirer.askConfig(jobName, key);
        // Asks: Host, Port, Username, Password, Remote directory
        // Returns: { sftpHost, sftpPort, sftpUser, sftpPwd, sftpPath }

        return Object.assign(providerAnswer, sftpConfig);
        // Result: { remoteType: 'SFTP', sftpHost, sftpPort... }

    } else if (providerAnswer.remoteType === 'S3') {
        const s3Config = await s3Inquirer.askConfig(jobName, key);
        // Asks: AWS credentials file path, AWS Region
        // Returns: { s3AccKeyLoc, s3Region }

        return Object.assign(providerAnswer, s3Config);
        // Result: { remoteType: 'S3', s3AccKeyLoc, s3Region }

    } else {
        // Should never reach here — inquirer list restricts choices
        // Safety net for any unexpected value
        throw new Error(
            `Unsupported remote type: '${providerAnswer.remoteType}'. ` +
            `Supported providers: Google Drive, SFTP, S3`
        );
    }
};

module.exports = {
    askConfig,
};