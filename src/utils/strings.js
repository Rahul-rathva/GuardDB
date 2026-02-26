//This file is the voice of GuardDB. It contains every message the user will ever see.

const configstore = require('conf');
const utils = require('./utils');
const constants = require('./constants');

const usageInfo = `usage: guarddb [--config module]
usage: guarddb [--config module] [--file filepath]
usage: guarddb [--help]
usage: guarddb [--run]
usage: guarddb [--start]
usage: guarddb [--version]`;

const helpDesc = `guarddb - automate database backups \n
${usageInfo} \n
Options:
  -c, --config=module           create or update module configuration (db | remote-sync | smtp)
  -D, --debug                   prints debugging information
  -h, --help                    prints this help menu
  -v, --version                 display version information`;

module.exports = {
    debugModeDesc: 'Re-run with --stacktrace or --debug to get more details about the error',
    validNoWarning: 'Please enter a valid number',
    usageInfo,
    helpDesc,
    synchlyStartedDesc: 'Spawning GuardDB jobs...',
    fileWoConfigArg: 'Use --file=filePath along with --config=module',
    moduleStatusEnabled: 'enabled',
    moduleStatusDisabled: 'disabled',
    serviceName: 'guarddb-nodejs',
    accountName: 'guarddbAdmin',
    encryptionTag: 'gArD', // Unique tag to identify GuardDB encrypted files
};