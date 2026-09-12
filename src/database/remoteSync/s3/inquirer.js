const inquirer = require('inquirer');
const files = require('../../utils/files');
const configstore = require('conf');

// ─────────────────────────────────────────────────────────────
// WHAT THIS FILE DOES:
// S3 specific setup prompts — three separate functions:
// askConfig()     → asks for AWS credentials file path
// askRemoteBuck() → asks which S3 bucket to use
// askRemoteLoc()  → asks which folder inside the bucket
// ─────────────────────────────────────────────────────────────

// FUNCTION 1: askConfig()
// Asks for path to AWS credentials JSON file
const askConfig = async (jobName, key) => {
    const jobConfStore = new configstore({configName: jobName, encryptionKey: key});
    const jobConfigObj = jobConfStore.store;

    const questions = [];

    questions.push({
        name: 's3AccKeyLoc',
        type: 'input',
        message: 'Enter the absolute path of the AWS credentials file:',
        default: jobConfigObj.s3AccKeyLoc,
        validate: (value) => {
            if (!value.length) {
                return 'Please enter the absolute path of the AWS credentials file.';
            }
            if (!files.directoryExists(value)) {
                return `No such file, '${value}'`;
                // ⚠️ ORIGINAL: 'No Such file' — inconsistent caps
                // Fixed: 'No such file'
            }
            if (!files.isFile(value)) {
                return `'${value}' is a directory.`;
            }
            return true;
        },
    });

    const s3Config = await inquirer.prompt(questions);
    return s3Config;
    // Returns: { s3AccKeyLoc: '/home/user/.aws/credentials.json' }
};

// FUNCTION 2: askRemoteBuck()
// Shows list of S3 buckets to pick from
const askRemoteBuck = async (buckets) => {
    const retObj = await inquirer.prompt({
        type: 'list',
        name: 's3ParentBucket',
        message: 'Choose the remote bucket in which backups will be stored:',
        choices: buckets,
        default: 0,
        pageSize: 4,
    });

    return retObj;
    // Returns: { s3ParentBucket: 'my-company-backups' }
};

// FUNCTION 3: askRemoteLoc()
// Shows list of folders inside selected bucket
const askRemoteLoc = async (bucket, folders) => {
    const retObj = await inquirer.prompt({
        type: 'list',
        name: 's3ParentFolder',
        message: `Choose the remote folder in "${bucket}" in which backups will be stored:`,
        // ⚠️ ORIGINAL: 'Choose the remote folder in ' + '"' + bucket + '"' + ...
        // Fixed: cleaner template literal
        choices: folders,
        default: 0,
        pageSize: 4,
    });

    return retObj;
    // Returns: { s3ParentFolder: 'guarddb/' }
};

module.exports = {
    askConfig,
    askRemoteBuck,
    askRemoteLoc,
};