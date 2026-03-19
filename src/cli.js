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