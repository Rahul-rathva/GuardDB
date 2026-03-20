const arg = require('arg'); 
// npm package that parses the commmand line argument;Converts the text into a js Object 
// without this we have to manually have to split the text and parse it; Industry Term Argument parser

const constants = require('./utils/constant');
//// Loads fixed, never-changing values
// Example: constants.PACKAGE_NAME = 'guarddb'
// Why separate file? If you rename the app, change it ONE place not 50

const strings = require('./utils/strings');
//all text message shown to users live here; Example: string.helpdesc = "usage guarddb --help"
//Industry term: string externalization ; also makes translation to otht langauges easier later

const db= require('./database/database');
//the database module - handles interaction with mysql , mongodb and postgresql
//what it can do: connect to db, export db, import db, list dbs, delete db backup , dump db, setup restore 
//cli calls this function but doesn't know how it works. This is abstraction.

const remoteSync = require('./remoteSync/remoteSync');
//handles cloud storage : google drive , S3 , SFTP
//function it exposes : setup congif, deletefile() , upload () 

const smtp = require('./smtp/smtp');
//handles email sending via smtp protocol; used for sending backup reports and alerts.
//function it exposes : setup config, sendmail() and SMTP : Simple Mail Transfer Protocol is a protocol for sending email messages between servers.

const backupScheduler = require('./backupScheduler');
// the scheduler runs automatic backup at set times;uses cron syntax internally.
//industry term: Cron job - a task scheduled to run at a specific times named after the grrek word cronus(time)

const configstore = require('conf');
//'config' npm package: stores settings in encryped files in json files on disk.
//each backup file has its own backup config file that stores the settings for that backup job.
//location on disk:usually on ~/config/guarddb (OS dependent);industry term;persistent configuration storage
//settings that survives after the app restarts

const packageJson = require('./../package.json');
//reads the package json file from the project root;//why?to get the version number from the --version flag
//package json always has(name:guardb, version:1.2.3)

const files = require('./utils/files');
//utilty function for file system operations like creating folders, deleting folders, checking if a file exists etc.

const inquirer = require('./inquirer');
// not the npm 'inquirer' package directly -  this is their custom wrapper;
//shows the inertactive prompts to users in terminal(yes/no questins, dropdown) industry term:interactive cli prompts

const utils = require('./utils/utils');
//general helper utilities used across the app; example: encrypting and decrypting config values, validating user input etc.


const cipher = require('./cipher/cipher');
//handles encryption and decryption of backup files; uses AES encryption under the hood; industry term: symmetric encryption - same key is used for both encrypting and decrypting data.
//industry term: cipher - an algorithm for performing encryption and decryption.

const keytar = require('keytar');
//keytar = "key" + "tar" keychain;reads and writes passwords from the OS's secire keychain;
//on windows:uses credential manager;Linux:uses libsecret;why not just store in a file?
//OS keychains are much more secure; Industry term: secret management - the practice of securely storing and managing sensitive information like passwords, API keys etc.

const backupDb = require('./backup');
// Our backup.js file we analyzed before!
// Used here for: backupDb.instantBackup() — manual on-demand backup
// The circle completes: cli.js calls backup.js which calls database.js

const defaultJobName = 'master';
// If user doesn't specify --job flag, use 'master' as the job name
// Like a default profile — most users only have one backup job
// Industry term: "Default value" / "Fallback" — what to use when nothing specified
// Example: guarddb --run          → uses 'master' job
//          guarddb --run --job work → uses 'work' job


//  FUNCTION 1: parseArgumentsIntoOptions(rawArgs)

const parseArgumentsIntoOptions = (rawArgs) =>{
    //rawArgs = process.argv = the raw text the user typed; EXAMPLE: ['node', 'guarddb','--config','db',....]
                                                                       //node   script   our actual argument starts here

    const args = arg(
        //first argument to arg():define which flags exists and their types 
        {
            '--config': String, //--config expects a string after it //usage: guarddb --config db //'db' is the string value
            '--disable': String , //usage : guarddb --disable email // disables a module, expects which module as string 
            '--debug': Boolean, //Boolean = no value needed;Just presence = true; // usage: guarddb --debug (just the flag no value afterwards)
            '--disable job': boolean ,// Usage: guarddb --disablejob --job myjob // Disables an entire backup job
            '--enable': String, //Usage: guarddb --enable remote-sync
            '--enable job': Boolean, //usage:guarddb --enablejob --job myjob 
            '--file': String, //guarddb: --config db --file /home/user/dbconfig.json//path to a config to load settings from 
            '--help': Boolean, //Usage: guarddb --help //shows the help text and exits 
            '--job': String,// Usage: guarddb --run --job mybackupjob// Specifies WHICH job to operate on
            '--jobs': Boolean,// Usage: guarddb --jobs// Lists ALL configured backup jobs in a table
            '--restore': Boolean,// Usage: guarddb --restore// Restores database from a backup
            '--reset': Boolean,// Usage: guarddb --reset --job myjob// Wipes all config for a job (destructive!)
            '--run': Boolean,// Usage: guarddb --run// Triggers an IMMEDIATE manual backup right now
            '--start': Boolean, // Usage: guarddb --start// Starts the automatic scheduler daemon// Industry term: "Daemon" — a background process that runs continuously
            '--stacktrace': Boolean, // Usage: guarddb --stacktrace// Shows full error details when something crashes
            '--version': Boolean,// Usage: guarddb --version // Prints version like "guarddb 1.2.3" and exits

            // ── ALIASES (shortcuts for the flags above) ──
            '-c': '--config',   // guarddb -c db  same as  guarddb --config db
            '-d': '--disable',
            '-D': '--debug',
            '-e': '--enable',
            '-f': '--file',
            '-h': '--help',
            '-j': '--job',
            '-R': '--restore',
            '-r': '--reset',
            '-S': '--stacktrace',
            '-v': '--version',
            // Note: --run, --start, --jobs, --disablejob, --enablejob
            // have no single-letter aliases — possible oversight or intentional
        },
        {
            argv: rawArgs.slice(2),
            // .slice(2) removes the first two items from rawArgs // rawArgs[0] = path to 'node' executable (not needed)// rawArgs[1] = path to this script file (not needed)
            // rawArgs[2 onwards] = actual user arguments (what we want)
            // Example: ['node', '/usr/bin/guarddb', '--config', 'db']
            //                                         ↑ slice(2) starts here
        }
    );


    // RETURNS a clean object with all parsed values// Any flag not provided by user = undefined
    return {
        config: args['--config'],       // 'db' | 'remote-sync' | 'smtp' | undefined
        debug: args['--stacktrace'] || args['--debug'],
        // BOTH --stacktrace AND --debug set the debug flag to true// Using OR (||): if either is true, debug = true
        // This means two different flags do the same thing// Industry term: "Flag aliasing at logic level"
        disablejob: args['--disablejob'],   // true | undefined
        disable: args['--disable'],         // 'smtp' | 'remote-sync' | 'cipher' | undefined
        enable: args['--enable'],           // 'smtp' | 'remote-sync' | 'cipher' | undefined
        enablejob: args['--enablejob'],     // true | undefined
        file: args['--file'],               // '/path/to/file.json' | undefined
        help: args['--help'],               // true | undefined
        job: args['--job'],                 // 'myjob' | undefined
        jobs: args['--jobs'],               // true | undefined
        restore: args['--restore'],         // true | undefined
        reset: args['--reset'],             // true | undefined
        run: args['--run'],                 // true | undefined
        start: args['--start'],             // true | undefined
        version: args['--version'],         // true | undefined
    };
    // This returned object is called 'options' in the cli() function below
};


   // FUNCTION 2: cli(args) — THE MAIN BRAIN
//This is the entire control flow. Every command the user types eventually runs through here.

const cli = async (args) => {
    // async = this function will do things that take time (DB connections, file I/O)
    // and we need to WAIT (await) for them to finish before moving on

    let dbStatus;
    // Declared but never used in this function — likely a leftover variable
    // ⚠️ BUG: dead variable, minor code smell

    let options;
    // Will hold the parsed command line arguments

    // ── STEP 1: PARSE ARGUMENTS ──
    try {
        options = parseArgumentsIntoOptions(args);
        // Converts raw text args into a clean options object
        // Example: guarddb --config db --job work
        // → options = { config: 'db', job: 'work', ... everything else undefined }
    } catch (err) {
        // arg() throws if user types an unknown flag
        // Example: guarddb --unknownflag → throws "Unknown or unexpected option: --unknownflag"
        console.error(`${err.name}: ${err.message}`);
        // err.name = 'ARG_UNKNOWN_OPTION'
        // err.message = 'Unknown or unexpected option: --unknownflag'
        console.log(strings.usageInfo);
        // Shows user how to correctly use the tool
        return;
        // EXITS the function — no point continuing if args are wrong
    }

    const isDebug = options.debug;
    // Saved separately for easy access throughout the function
    // Used in catch blocks to decide: show full error or simple message?

    // ── WRAP EVERYTHING IN TRY/CATCH ──
    try {
        // Every command is handled inside this try block
        // If ANYTHING throws, the catch at the bottom handles it

        // ── STEP 2: HANDLE --version FLAG ──
        if (options.version) {
            console.log(`${constants.PACKAGE_NAME} ${packageJson.version}`);
            // Prints: "guarddb 1.2.3"
            // packageJson.version comes from package.json — single source of truth
            return;
            // Early return — don't do anything else
            // Industry term: "Guard clause" — exit early for simple cases
        }

        // ── STEP 3: HANDLE --help FLAG ──
        if (options.help) {
            console.log(strings.helpDesc);
            // Prints the full help text (stored in strings.js)
            return;
        }

        // ── STEP 4: GET THE ENCRYPTION KEY FROM OS KEYCHAIN ──
        const key = await keytar.getPassword(strings.serviceName, strings.accountName);
        // keytar talks to the OS secure keychain
        // strings.serviceName = something like 'guarddb'
        // strings.accountName = something like 'master-key'
        // key = the master encryption password for all config files
        // await = wait for OS to respond (async operation)
        // If key doesn't exist yet (first run): key = null
        // This key is then passed to configstore to decrypt stored settings

        // ── STEP 5: LOAD CONFIGURATION ──
        const confStore = new configstore();
        // The MASTER config store — stores job names and enabled/disabled states
        // File on disk: ~/.config/guarddb/config.json (approximately)
        // Contains: { "master": { "enabled": true }, "work": { "enabled": false } }

        const jobName = options.job || defaultJobName;
        // options.job = what user typed after --job flag
        // If they didn't use --job, use 'master'
        // || = OR operator: "use options.job, or if undefined/null, use defaultJobName"
        // Examples:
        //   guarddb --run                → jobName = 'master'
        //   guarddb --run --job work     → jobName = 'work'

        let jobConfStore = new configstore({configName: jobName, encryptionKey: key});
        // Creates a config store SPECIFIC to this job
        // configName: 'master' → reads/writes to a file named 'master.json'
        // encryptionKey: key   → decrypts the file contents using the master key
        // Industry term: "Per-tenant configuration" — each job has isolated settings

        const jobConfigObj = jobConfStore.store;
        // .store = gets the entire config as a plain JavaScript object
        // Example: {
        //   dbType: 'mysql',
        //   dbName: 'mydb',
        //   dbBackupPath: '/home/user/backups',
        //   dbNoOfDays: 7,
        //   dbSetupComplete: true,
        //   remoteSyncEnabled: false,
        //   smtpEnabled: true
        // }

        // ── STEP 6: HANDLE --reset FLAG ──
        if (options.reset) {
            const resetConfirm = await inquirer.askResetConfirmation(jobName);
            // Shows interactive prompt: "Are you sure you want to reset 'master'? (y/n)"
            // await: wait for user to type their answer
            // Returns: { resetConfirmation: true } or { resetConfirmation: false }

            if (resetConfirm.resetConfirmation) {
                console.log(`Resetting configurations for the job '${jobName}`);
                // ⚠️ BUG: Missing closing quote in template literal
                // Should be: `Resetting configurations for the job '${jobName}'`

                jobConfStore.clear();
                // Deletes ALL settings from this job's config file
                // Like factory reset for this specific job

                confStore.delete(jobName);
                // Removes this job's entry from the MASTER config
                // After this: the job 'master' no longer exists anywhere

                console.log('Success');
                return;
                // Job is gone, nothing more to do
            } else {
                return;
                // User said no — do nothing, exit
            }
        }

        // ── STEP 7: HANDLE --jobs FLAG ──
        if (options.jobs) {
            printJobsList(key);
            // Calls printJobsList() function (defined later in file)
            // Prints a formatted table of all backup jobs
            // Note: No 'return' here — execution continues after this
            // This might be intentional (allow --jobs combined with other flags)
            // but is unusual and could cause unexpected behavior
        }

        // ── STEP 8: SHOW USAGE IF NO VALID FLAGS ──
        if (
            !options.config &&
            !options.disablejob &&
            !options.disable &&
            !options.enablejob &&
            !options.enable &&
            !options.file &&
            !options.help &&
            !options.jobs &&
            !options.restore &&
            !options.reset &&
            !options.run &&
            !options.start &&
            !options.version
        ) {
            // ! = NOT operator
            // If ALL of these are falsy (undefined/false/null)
            // = user typed 'guarddb' with no flags at all
            console.log(strings.usageInfo);
            // Show: "Usage: guarddb [options]..."
            return;
        }

        // ── STEP 9: VALIDATE --config ARGUMENT ──
        if (options.config) {
            if (configAllowedArgs.indexOf(options.config) == -1) {
                // configAllowedArgs = ['db', 'remote-sync', 'smtp']
                // .indexOf() returns -1 if value NOT found in array
                // So: if the config argument is NOT in the allowed list
                console.error(`Unknown or unexpected argument: ${options.config}`);
                console.error(`Allowed arguments are ${configAllowedArgs}`);
                // Note: No 'return' here!
                // ⚠️ BUG: Execution CONTINUES even after this error
                // Should add 'return;' to stop processing invalid config
            }
        }

        // ── STEP 10: VALIDATE --file REQUIRES --config ──
        if (!options.config && options.file) {
            // User typed --file without --config
            // Makes no sense — file is only for loading config settings
            console.error(strings.fileWoConfigArg);
            // fileWoConfigArg = "Flag --file requires --config flag"
            return;
        }

        // ── STEP 11: VALIDATE --enable AND --disable ARGUMENTS ──
        if (options.enable || options.disable) {
            let givenArg;
            if (options.enable) givenArg = options.enable;
            else givenArg = options.disable;
            // Gets whichever one was provided

            if (modAllowedArgs.indexOf(givenArg) == -1) {
                // modAllowedArgs = ['cipher', 'remote-sync', 'smtp']
                console.error(`Unknown or unexpected argument: ${givenArg}`);
                console.error(`Allowed arguments are ${modAllowedArgs}`);
                // ⚠️ BUG: Again no 'return;' — continues executing with invalid arg
            }
        }

        // ── STEP 12: VALIDATE --file PATH IF PROVIDED ──
        if (options.config && options.file) {
            if (options.file.length) {
                // options.file.length > 0 means a path was actually given

                if (!files.directoryExists(options.file)) {
                    // Check if the file path actually exists on disk
                    console.error(`No Such file, '${options.file}'`);
                    return;
                }

                let isFile = files.isFile(options.file);
                // Check that it's a FILE, not a FOLDER
                // Someone might accidentally type a directory path

                if (!isFile) {
                    console.log(`'${options.file}' is a directory.`);
                    return;
                }
            } else {
                return 'Flag --file requires the absolute path of the config init file as an argument.';
                // ⚠️ BUG: 'return' with a string value from an async function
                // This value is LOST — nobody receives it
                // Should be: console.error(...) then return;
            }
        }

        // ── STEP 13: HANDLE --config FLAG ──
        if (options.config == 'db') {
            let dbSetupRes = await db.setupConfig(jobName, key, isDebug, options.file);
            // db.setupConfig() shows interactive prompts:
            //   "Which database? (MySQL / MongoDB / PostgreSQL)"
            //   "Database host?" "Database port?" etc.
            // Saves answers to jobConfStore
            // Returns: true if setup completed, false/null if cancelled

            if (dbSetupRes) {
                let enableJobRes = await enableJob(jobName, key, isDebug);
                // After DB is configured, automatically enable this job
                // Makes sense UX-wise: user just set up DB, they want it running
            }
        } else if (options.config == 'remote-sync') {
            let remoteSetupRes = await remoteSync.setupConfig(jobName, key, isDebug, options.file);
            // Shows prompts: "Which provider? (Google Drive / S3 / SFTP)"
            // Then provider-specific prompts (S3 bucket name, region, credentials etc.)
        } else if (options.config == 'smtp') {
            let smtpSetupRes = await smtp.setupConfig(jobName, key, isDebug, options.file);
            // Shows prompts: "SMTP host?" "Port?" "Email?" "Password?"
            // Saves email config to send backup status reports
        }

        // ── STEP 14: HANDLE --enable FLAG ──
        if (options.enable == 'remote-sync') {
            if (!jobConfigObj.remoteSetupComplete) {
                // remoteSetupComplete = false means remote sync was never configured
                console.log('Finish the remote sync configuration below before enabling');
                let remoteSetupRes = await remoteSync.setupConfig(jobName, key, isDebug);
                // Automatically starts configuration flow
                if (remoteSetupRes) {
                    console.log(`Enabling module 'remote-sync'`);
                    jobConfStore.set('remoteSyncEnabled', true);
                    // .set() writes ONE key to the config file
                    // After this: config file has remoteSyncEnabled: true
                    console.log('Success');
                }
            } else if (jobConfigObj.remoteSyncEnabled) {
                console.log(`Module 'remote-sync' already enabled`);
                // Idempotent operation: safe to call multiple times
                // Industry term: "Idempotency" — doing something twice = same result as once
            } else {
                console.log(`Enabling module 'remote-sync'`);
                jobConfStore.set('remoteSyncEnabled', true);
                console.log('Success');
            }
        } else if (options.enable == 'smtp') {
            // Same pattern as remote-sync above
            if (!jobConfigObj.smtpSetupComplete) {
                console.log('Finish the smtp configuration below before enabling');
                let smtpSetupRes = await smtp.setupConfig(jobName, key, isDebug);
                if (smtpSetupRes) {
                    console.log(`Enabling module 'smtp'`);
                    jobConfStore.set('smtpEnabled', true);
                    console.log('Success');
                }
            } else if (jobConfigObj.smtpEnabled) {
                console.log(`Module 'smtp' already enabled`);
            } else {
                console.log(`Enabling module 'smtp'`);
                jobConfStore.set('smtpEnabled', true);
                console.log('Success');
            }
        } else if (options.enable == 'cipher') {
            let securitySetup = null;
            let config = confStore.store;
            // Read the MASTER config (not job-specific)

            if (!config.isEncrypted) {
                securitySetup = await cipher.setupConfig(isDebug);
                // Sets up file encryption for backup files
                // Shows prompts: "Create encryption password"
                // After this: all backup files are encrypted
            } else {
                console.log('Encyrption already enabled');
                // ⚠️ BUG: Typo! "Encyrption" should be "Encryption"
                // Minor but unprofessional in production code
            }
        }

        // ── STEP 15: HANDLE --disable FLAG ──
        if (options.disable == 'remote-sync') {
            if (!jobConfigObj.remoteSyncEnabled) {
                console.log(`Module 'remote-sync' already disabled`);
            } else {
                console.log(`Disabling module 'remote-sync'`);
                jobConfStore.set('remoteSyncEnabled', false);
                // Simply flips the boolean in config
                console.log('Success');
            }
        } else if (options.disable == 'smtp') {
            if (!jobConfigObj.smtpEnabled) {
                console.log(`Module 'smtp' already disabled`);
            } else {
                console.log(`Disabling module 'smtp'`);
                jobConfStore.set('smtpEnabled', false);
                console.log('Success');
            }
        } else if (options.disable == 'cipher') {
            let config = confStore.store;
            let deleteConfig;
            if (config.isEncrypted) {
                deleteConfig = await cipher.deleteConfig(key);
                // Removes encryption setup
                // Decrypts all existing backup files back to plain form
            } else {
                console.log('Encryption already disabled');
            }
        }

        // ── STEP 16: HANDLE --enablejob FLAG ──
        if (options.enablejob) {
            let enableJobRes = await enableJob(jobName, key, isDebug);
            // Calls enableJob() helper function (defined outside cli())
            // Industry term: "Job scheduling activation"
        }

        // ── STEP 17: HANDLE --disablejob FLAG ──
        if (options.disablejob) {
            if (!jobConfigObj.dbSetupComplete) {
                console.error(`Job '${jobName}' does not exist!`);
                // dbSetupComplete = false means DB was never configured
                // = this job was never properly set up
            } else if (!confStore.get(`${jobName}.enabled`)) {
                // confStore.get('master.enabled') reads nested property
                // Dot notation in key: reads { master: { enabled: false } }
                console.log(`Job '${jobName} already disabled`);
                // ⚠️ BUG: Missing closing quote → Job 'master already disabled
                // Should be: `Job '${jobName}' already disabled`
            } else {
                console.log(`Disabling job '${jobName}`);
                // ⚠️ BUG: Same missing closing quote pattern
                confStore.set(`${jobName}.enabled`, false);
                // Sets master.enabled = false in master config
                // Scheduler will skip this job when running
                console.log('Success');
            }
        }

        // ── STEP 18: HANDLE --run FLAG (INSTANT BACKUP) ──
        if (options.run) {
            if (!jobConfigObj.dbSetupComplete) {
                console.error(`Job '${jobName}' does not exist!`);
            } else {
                await backupDb.instantBackup(jobName, key, isDebug);
                // Calls backup.js → database.js → actually dumps the DB right now
                // This is the manual "backup now" button
                // No scheduler involved — runs immediately
                // await: wait for the entire backup to finish before returning
            }
        }

        // ── STEP 19: HANDLE --start FLAG (START SCHEDULER) ──
        if (options.start) {
            const jobNamesConfig = confStore.store;
            // Gets ALL jobs from master config
            // Example: { master: { enabled: true }, work: { enabled: false } }

            let jobNames = [];
            for (let j in jobNamesConfig) {
                // for...in loop iterates over all KEYS of an object
                // j = 'master', then j = 'work', etc.
                if (jobNamesConfig[j].enabled) jobNames.push(j);
                // Only include ENABLED jobs
                // jobNames = ['master'] (if work is disabled)
            }

            backupScheduler(jobNames, key, isDebug);
            // Starts the background scheduler with only enabled jobs
            // This runs FOREVER (until process is killed)
            // Industry term: "Long-running process" / "Daemon process"
            // Internally uses node-cron to run backups at configured times
            // Note: no 'await' — scheduler starts and this function returns
            // The scheduler continues running in the background
        }

        // ── STEP 20: HANDLE --restore FLAG ──
        if (options.restore) {
            let restoreSetup;
            if (jobConfigObj.dbSetupComplete) {
                restoreSetup = await db.setupRestore(jobName, key, isDebug);
                // Shows prompts: "Which backup to restore from?"
                // Lists available backup directories
                // Restores the selected backup into the database
                // Industry term: "Point-in-time recovery" (PITR)
            } else {
                console.log('Finish the db configuration before restoring from a backup');
                // Can't restore if DB isn't configured yet
            }
        }

    } catch (err) {
        // Catches ANY unhandled error from ANY of the above steps
        console.error(`${err.name}: ${err.message}`);
        // Friendly one-line error message

        if (isDebug) {
            console.error('Stacktrace:');
            console.error(err);
            // Full stack trace: shows exactly which line failed and why
            // Used during development/troubleshooting
        } else {
            console.error(strings.debugModeDesc);
            // In normal mode: just says "Run with --debug for more details"
            // Keeps output clean for end users
        }
    }
};

// FUNCTION 3: enableJob(jobName, key, isDebug)

const enableJob = async (jobName, key, isDebug) => {
    // Helper function called from two places:
    // 1. After --config db (auto-enable after DB setup)
    // 2. When user runs --enablejob explicitly
    // Kept separate to avoid code duplication (DRY principle)
    // DRY = Don't Repeat Yourself — fundamental programming principle

    const confStore = new configstore();
    // MASTER config (stores which jobs exist and enabled/disabled)

    const jobConfStore = new configstore({configName: jobName, encryptionKey: key});
    // JOB-SPECIFIC config (stores DB settings, backup paths, etc.)

    const jobConfigObj = jobConfStore.store;
    // Plain object version of job config

    if (!jobConfigObj.dbSetupComplete) {
        // Can't enable a job if the database isn't configured
        // dbSetupComplete is set to true by db.setupConfig() when done
        console.log('Finish the db configuration below before enabling a job');
        let dbSetup = await db.setupConfig(jobName, isDebug);
        // ⚠️ BUG: Missing 'key' parameter!
        // Should be: db.setupConfig(jobName, key, isDebug)
        // Without key, config may not encrypt/decrypt properly

        if (dbSetup) {
            console.log(`Enabling job '${jobName}'`);
            confStore.set(`${jobName}.enabled`, true);
            // Writes { master: { enabled: true } } to master config
            console.log('Success');
        }
    } else if (confStore.get(`${jobName}.enabled`)) {
        // Job is already enabled
        console.log(`Job '${jobName}' already enabled`);
    } else {
        // DB is configured, job just needs to be enabled
        console.log(`Enabling job '${jobName}'`);
        confStore.set(`${jobName}.enabled`, true);
        console.log('Success');
    }
};

//FUNCTION 4: printJobsList(key)

const printJobsList = (key) => {
    // Prints a formatted table of ALL backup jobs
    // Like a dashboard overview of the whole system

    let jobsListTable = utils.createJobsListTable();
    // Creates an empty table structure with headers:
    // | Job Name | Status | DB Type | DB Name | Backup Time | Remote Sync | SMTP |

    const confStore = new configstore();
    // Read master config to get all job names

    const jobNamesConfig = confStore.store;
    // Example: { master: { enabled: true }, work: { enabled: false } }

    const statusEnabled = strings.moduleStatusEnabled;   // e.g., '✓ Enabled'
    const statusDisabled = strings.moduleStatusDisabled; // e.g., '✗ Disabled'

    for (let currentJob in jobNamesConfig) {
        // Loop over every job

        if (currentJob == 'isEncrypted') {
            continue;
            // 'isEncrypted' is stored in the same master config
            // but it's NOT a job name — skip it
            // Industry term: "Sentinel value" — a special value mixed with data
            // that needs to be filtered out
        }

        const jobConfStore = new configstore({configName: currentJob, encryptionKey: key});
        const jobConfObj = jobConfStore.store;
        // Load each job's specific settings

        const currJobStatus = jobNamesConfig[currentJob].enabled == true 
            ? statusEnabled 
            : statusDisabled;
        // Ternary: enabled? show ✓ : show ✗

        const remoteSyncStatus = jobConfObj.remoteSyncEnabled == true 
            ? statusEnabled 
            : statusDisabled;

        const smtpStatus = jobConfObj.smtpEnabled == true 
            ? statusEnabled 
            : statusDisabled;

        const backupTime = new Date(jobConfObj.dbBackupTime).toTimeString().match(/([0-9]+:[0-9]+)/)[1];
        // Step by step:
        // 1. jobConfObj.dbBackupTime = a stored timestamp, e.g., 1700000000000 (milliseconds)
        // 2. new Date(1700000000000) = converts to Date object
        // 3. .toTimeString() = "14:30:00 GMT+0530 (India Standard Time)"
        // 4. .match(/([0-9]+:[0-9]+)/) = regex to find "14:30" pattern
        //    /([0-9]+:[0-9]+)/ means: one or more digits, colon, one or more digits
        // 5. [1] = gets first capture group = "14:30"
        // Industry term: "Regex (Regular Expression)" — pattern matching for strings

        const backupTimeTz = new Date(jobConfObj.dbBackupTime).toString().match(/([A-Z]+[\+-][0-9]+)/)[1];
        // Similar process but extracts timezone
        // .toString() = "Fri Nov 15 2024 14:30:00 GMT+0530 (India Standard Time)"
        // regex /([A-Z]+[\+-][0-9]+)/ matches "GMT+0530" pattern
        //   [A-Z]+ = one or more capital letters (GMT)
        //   [\+-] = a + or - sign
        //   [0-9]+ = one or more digits (0530)
        // [1] = "GMT+0530"

        const backupTimeString = `${backupTime} ${backupTimeTz}`;
        // Combined: "14:30 GMT+0530"

        jobsListTable.push([
            currentJob,        // "master"
            currJobStatus,     // "✓ Enabled"
            jobConfObj.dbType, // "mysql"
            jobConfObj.dbName, // "production_db"
            backupTimeString,  // "14:30 GMT+0530"
            remoteSyncStatus,  // "✗ Disabled"
            smtpStatus,        // "✓ Enabled"
        ]);
        // Adds one row to the table for this job
    }

    console.log(jobsListTable.toString());
    // Renders the table to terminal
    // Output looks like:
    // ┌────────┬───────────┬───────┬──────────────┬────────────┬─────────────┬──────────┐
    // │ master │ ✓ Enabled │ mysql │ production_db│ 14:30 IST  │ ✗ Disabled  │ ✓ Enabled│
    // └────────┴───────────┴───────┴──────────────┴────────────┴─────────────┴──────────┘
};

    module.exports = {
    cli,
    // Only exports the main cli() function
    // parseArgumentsIntoOptions, enableJob, printJobsList are PRIVATE
    // They're internal helpers — external code shouldn't call them directly
    // Industry term: "Encapsulation" — hide internals, expose only what's needed
};