const inquirer = require('inquirer');
const configstore = require('conf');
const strings = require('./../../utils/strings');

// ─────────────────────────────────────────────────────────────
// WHAT THIS FILE DOES:
// SFTP specific setup prompts
// Called from remoteSync/inquirer.js after user picks SFTP
// Asks for all SFTP connection details needed to connect
// ─────────────────────────────────────────────────────────────

const askConfig = async (jobName, key) => {
    const jobConfStore = new configstore({configName: jobName, encryptionKey: key});
    const jobConfigObj = jobConfStore.store;
    // Load existing config to pre-fill defaults if reconfiguring

    const questions = [];

    // QUESTION 1: SFTP Server Hostname or IP
    questions.push({
        name: 'sftpHost',
        type: 'input',
        message: 'Enter the hostname or IP of the remote server:',
        default: jobConfigObj.sftpHost,
        validate: (value) => {
            if (value.length) return true;
            return 'Please enter the hostname or IP of the remote server.';
        },
    });

    // QUESTION 2: SFTP Port
    questions.push({
        name: 'sftpPort',
        type: 'input',
        message: 'Enter the port number of the remote server:',
        default: jobConfigObj.sftpPort || '22',
        // Default SFTP/SSH port is 22
        // Added sensible default — original had no default
        validate: (value) => {
            if (!value.length) {
                return 'Please enter the port number of the remote server.';
                // ⚠️ ORIGINAL BUG: error said "hostname or IP"
                // Fixed to say "port number"
            }
            if (isNaN(value) || Number(value) === 0) {
                return strings.validNoWarning;
            }
            if (Number(value) < 1 || Number(value) > 65535) {
                return 'Port must be between 1 and 65535.';
                // Full port range validation — same fix as database/inquirer.js
            }
            return true;
        },
    });

    // QUESTION 3: SFTP Username
    questions.push({
        name: 'sftpAuthUser',
        type: 'input',
        message: 'Enter the username for authentication:',
        default: jobConfigObj.sftpAuthUser,
        validate: (value) => {
            if (value.length) return true;
            return 'Please enter the username for authentication.';
        },
    });

    // QUESTION 4: SFTP Password
    questions.push({
        name: 'sftpAuthPwd',
        type: 'password',
        mask: '*',
        // ⚠️ ORIGINAL: mask: true — should be a character
        // Fixed: mask: '*'
        message: 'Enter the password for authentication:',
        // No default — never pre-fill passwords (security risk)
        validate: (value) => {
            if (value.length) return true;
            return 'Please enter the password for authentication.';
        },
    });

    // QUESTION 5: Remote Backup Directory Path
    questions.push({
        name: 'sftpBackupPath',
        type: 'input',
        message: 'Enter the absolute path of the directory for storing backups on the remote server:',
        default: jobConfigObj.sftpBackupPath,
        // Cannot validate existence here — path is on REMOTE server
        // Local files.directoryExists() won't work for remote paths
        // Validation happens in exists() during connection test
        validate: (value) => {
            if (value.length) return true;
            return 'Please enter the absolute path of the directory for storing backups on the remote server.';
        },
    });

    const sftpConfig = await inquirer.prompt(questions);
    return sftpConfig;
    // Returns: {
    //   sftpHost: 'backup.myserver.com',
    //   sftpPort: '22',
    //   sftpAuthUser: 'backupuser',
    //   sftpAuthPwd: 'secret123',
    //   sftpBackupPath: '/home/backups'
    // }
};

module.exports = {
    askConfig,
};