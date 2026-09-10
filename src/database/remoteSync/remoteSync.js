const configstore = require('conf');
const constants = require('./../utils/constants');
const strings = require('./../utils/strings');
const inquirer = require('./inquirer');
const gDrive = require('./gDrive/gDrive');
const gDriveInquirer = require('./gDrive/inquirer');
const sftp = require('./sftp/sftp');
const s3 = require('./s3/s3');
const s3Inquirer = require('./s3/inquirer');
const ora = require('ora');
const validator = require('./validator');

const setupConfig = async (jobName, key, isDebug, filePath = undefined) => {
    const jobConfStore = new configstore({configName: jobName, encryptionKey: key});
    const connStatus = ora('Authenticating you, please wait...');

    try {
        let config;

        if (filePath) {
            config = require(filePath);
            connStatus.start();
            config = await validator.validateInitConfig(config);
        } else {
            config = await inquirer.askConfig(jobName, key);
            connStatus.start();
        }

        if (config.remoteType === 'Google Drive') {
            let folders = await gDrive.listFolders(jobName, key, config);
            connStatus.succeed('Authentication success');

            folders = folders.map((f) => ({ name: f.name, value: f.id }));
            const gdConfig = await gDriveInquirer.askRemoteLoc(folders);
            config = Object.assign(config, gdConfig);

            const cloneKeyRes = await gDrive.cloneServiceAccKey(jobName, key, config.gDriveServiceAccKeyLoc);
            if (!cloneKeyRes) {
                throw new Error('Failed to copy Google Drive service account key');
            }

        } else if (config.remoteType === 'SFTP') {
            const isExists = await sftp.exists(jobName, key, config);
            if (!isExists) {
                throw new Error('SFTP server unreachable — check host, port, and credentials');
            }
            connStatus.succeed('Authentication success');

        } else if (config.remoteType === 'S3') {
            let buckets = await s3.listBuckets(jobName, key, config);
            connStatus.succeed('Authentication success');

            buckets = buckets.map((b) => ({ name: b.Name }));
            const s3ConfigBuck = await s3Inquirer.askRemoteBuck(buckets);
            config = Object.assign(config, s3ConfigBuck);

            let folders = await s3.listFolders(jobName, key, config);
            folders = folders.map((f) => ({ name: f.Name }));
            const s3ConfigLoc = await s3Inquirer.askRemoteLoc(s3ConfigBuck.s3ParentBucket, folders);
            config = Object.assign(config, s3ConfigLoc);

            const cloneKeyRes = await s3.cloneServiceAccKey(jobName, key, config.s3AccKeyLoc);
            if (!cloneKeyRes) {
                throw new Error('Failed to copy S3 credentials file');
            }
        } else {
            throw new Error(`Unsupported remote type: '${config.remoteType}'. Supported: Google Drive, SFTP, S3`);
        }

        config.remoteSetupComplete = true;
        jobConfStore.set(config);
        console.log('Remote Sync configuration updated successfully.');
        return config;

    } catch (err) {
        connStatus.fail('Authentication failed');
        console.error('Remote Sync configuration update failed.');
        console.error(`${err.name}: ${err.message}`);
        console.error('Re run with --config remote-sync to finish the configuration');
        if (isDebug) {
            console.error('Stacktrace:');
            console.error(err);
        } else {
            console.error(strings.debugModeDesc);
        }
    }
};

const uploadFile = async (jobName, key, fileName, filePath) => {
    const jobConfStore = new configstore({configName: jobName, encryptionKey: key});
    const remoteType = jobConfStore.get('remoteType');
    let resp;

    if (remoteType === 'Google Drive') {
        resp = await gDrive.uploadFile(jobName, key, fileName, filePath);
    } else if (remoteType === 'SFTP') {
        resp = await sftp.uploadFile(jobName, key, fileName, filePath);
    } else if (remoteType === 'S3') {
        resp = await s3.uploadFile(jobName, key, fileName, filePath);
    } else {
        throw new Error(`Unsupported remote type: '${remoteType}'`);
    }

    return resp;
};

const deleteFile = async (jobName, key, fileName) => {
    const jobConfStore = new configstore({configName: jobName, encryptionKey: key});
    const remoteType = jobConfStore.get('remoteType');
    let resp;

    if (remoteType === 'Google Drive') {
        resp = await gDrive.deleteFile(jobName, key, fileName);
    } else if (remoteType === 'SFTP') {
        resp = await sftp.deleteFile(jobName, key, fileName);
    } else if (remoteType === 'S3') {
        resp = await s3.deleteFile(jobName, key, fileName);
    } else {
        throw new Error(`Unsupported remote type: '${remoteType}'`);
    }

    return resp;
};

module.exports = {
    setupConfig,
    uploadFile,
    deleteFile,
};