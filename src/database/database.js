const strings = require('./../utils/strings');
//goes up one level (..) then into utils/strings //used for :strings.debugMOdedesc (shown when isdebug is false)
//the .. means that go to parents folder first //path : database/../utils/strings = utils/strings

const configstore = require('conf');
//encrpted config storage - -same as everwhere else // used here to :Read job config in dump() and setupRestore()
//and write upadted config after successful setup in setupConfig()

const mongoDb = require('./mongoDb/mongoDb');
//loads the mongoDb speacialist module // has funstions like connect,dump and restore 
//this file delegates all the work to this module.

const mysqlDb = require('./mysql/mysql');
//loads the mysql specialist module // same interface: connect (),dump(), restore().
//Notice: same function name as mongodb- consistent API design
//industry term: "consistent interface"/"polymorphism" //All the three database module speaks the same language

const postgresql = require('./posgresql/postgresql');
//same interface again .connect , dump and restore 

const inquirer = require('./inquirer');
//this is the database folder's OWN inquirer.js  //not the top level inquirer.js(which only had askresetconfirmation)
//this one has database specofic questions : askconfig() - "which database type"?host?port? username ?password?
//askRestoreConfig() - "which backup files to restore from?"  //Path : ./inquirer = database/inquirer.js

const ora = require('ora');
//terminal spinner for long running operations // used twice :"Authencating you, please wait. "during the db connection test 
//2. "restoring, please wait, ..." during backup restore  //shows the user that the system is workong fine and not frozen

const validator = require('./validator');
//validates config when loaded from a file(--file flag)  // when a user provides a json config file instead of answering prompts
//validator.validateinitconfig() checks the  file has correct structure. // if config  file has wrong keys or missing values  -> throws an error early 
//industry term : "input validation "/"Schema validation"

const setupConfig = async (jobName, key, isDebug, filePath = undefined) => {
//                                                  ↑
//                  DEFAULT PARAMETER — if filePath not provided, use undefined
//                  Same as: if (filePath === undefined) filePath = undefined
//                  But cleaner — shows the default value right in signature
//                  Industry term: "Default parameter" / "Optional parameter"
//
//                  Usage:
//                  setupConfig('master', key, false)          → filePath = undefined
//                  setupConfig('master', key, false, '/a/b')  → filePath = '/a/b'

    const jobConfStore = new configstore({configName: jobName, encryptionKey: key});
    // Opens this job's encrypted config file
    // We'll WRITE to this at the end if setup succeeds
    // jobName = 'master' → reads/writes master.json (encrypted)

    let dbConnStatus;
    dbConnStatus = ora('Authenticating you, please wait...');
    // Creates spinner but does NOT start it yet
    // .start() is called AFTER config is collected
    // Why wait? Config collection (prompts/file reading) happens first
    // Spinner should only show during the actual connection test
    //
    // ⚠️ STYLE ISSUE: Two lines where one would work:
    // let dbConnStatus = ora('Authenticating you, please wait...');

    try {
        let config;
        // Will hold the DB configuration object
        // Either from file or from interactive prompts
        // Example config object:
        // {
        //   dbType: 'MySQL',
        //   dbHost: 'localhost',
        //   dbPort: '3306',
        //   dbUsername: 'root',
        //   dbPassword: 'secret',
        //   dbName: 'myDatabase',
        //   dbBackupPath: '/home/user/backups',
        //   dbNoOfDays: 7,
        //   dbNoOfWeeks: 4,
        //   dbNoOfMonths: 3
        // }

        if (filePath) {
            // PATH 1: User provided a config file
            // Example: guarddb --config db --file /home/user/dbconfig.json
            
            config = require(filePath);
            // Dynamically requires a JSON file at runtime
            // require() can load JSON files directly
            // filePath = '/home/user/dbconfig.json'
            // config = { dbType: 'MySQL', dbHost: 'localhost', ... }
            //
            // Industry term: "Dynamic require" — path determined at runtime
            // ⚠️ SECURITY NOTE: Loading arbitrary file paths can be dangerous
            // Should validate filePath before requiring
            // Malicious path could load unexpected code

            dbConnStatus.start();
            // Start spinner NOW — about to validate (takes a moment)

            config = await validator.validateInitConfig(config);
            // Validates the loaded config has all required fields
            // Checks types, required keys, valid values
            // Returns: cleaned/normalized config object if valid
            // Throws: error if any field is missing or wrong
            // await: validation might be async (checking formats etc.)

        } else {
            // PATH 2: No file — ask user interactively
            
            config = await inquirer.askConfig(jobName, key);
            // Shows interactive prompts:
            // ? Which database? (MySQL / MongoDB / PostgreSQL)
            // ? Database host: (localhost)
            // ? Database port: (3306)
            // ? Database name:
            // ? Database username:
            // ? Database password: (hidden)
            // ? Backup storage path:
            // ? Keep backups for how many days: (7)
            // await: waits for user to answer all questions

            dbConnStatus.start();
            // Start spinner AFTER prompts are answered
            // Now about to test the connection
        }

        const dbConnRes = await connect(config);
        // Tests if the DB connection actually works
        // Calls connect() function defined below in this same file
        // connect() routes to mongoDb.connect() / mysql.connect() etc.
        // If DB is unreachable / wrong password → THROWS error
        // await: network operation — takes time
        // dbConnRes = connection result (varies by DB type)

        dbConnStatus.succeed('Authentication success');
        // ✓ Authentication success   ← shown in terminal
        // Stops spinner with green checkmark

        config.dbSetupComplete = true;
        // Adds a flag to the config object
        // This flag is checked EVERYWHERE in cli.js:
        //   if (!jobConfigObj.dbSetupComplete) → "job doesn't exist"
        // Without this flag: job appears unconfigured even after setup
        // Industry term: "Status flag" / "Completion marker"

        jobConfStore.set(config);
        // Saves the ENTIRE config object to encrypted file
        // All fields at once: dbType, dbHost, dbPort, dbName,
        //                     dbUsername, dbPassword, dbBackupPath,
        //                     dbNoOfDays, dbNoOfWeeks, dbNoOfMonths,
        //                     dbSetupComplete: true
        // After this: master.json contains all DB settings (encrypted)
        //
        // ⚠️ SECURITY NOTE: dbPassword is stored in config
        // Protected by encryptionKey — only readable with master key
        // Industry term: "Encrypted at rest"

        console.log('Database configuration updated successfully.');

        return dbConnRes;
        // Returns the connection result to caller (cli.js)
        // cli.js checks: if (dbSetupRes) { enableJob(...) }
        // Truthy return = setup worked = enable the job

    } catch (err) {
        dbConnStatus.fail('Authentication failed');
        // ✗ Authentication failed   ← shown in terminal
        // Red X instead of green checkmark

        console.error('Database configuration update failed.');
        console.error(`${err.name}: ${err.message}`);
        // err.name    = 'MongoServerError' / 'Error' / 'ValidationError'
        // err.message = 'Authentication failed' / 'ECONNREFUSED' etc.

        console.error('Re run with --config db to finish the configuration');
        // Tells user exactly what to do next
        // Industry term: "Actionable error message"
        // Don't just say "it failed" — say what to DO about it

        if (isDebug) {
            console.error('Stacktrace:');
            console.error(err);
            // Full error object with stack trace
            // Used during development/troubleshooting
        } else {
            console.error(strings.debugModeDesc);
            // "Run with --debug for more details"
        }
        // Note: no return here — function returns undefined on error
        // cli.js: if (dbSetupRes) → undefined is falsy → job NOT enabled
        // Correct behavior: don't enable job if setup failed
    }
};

const connect = async (dbConfig) => {
    // dbconfig = the config object with all DB settings
    // most importantly: dbConfig.dbTYpe tells us which DB to use 

    let resp;
    // will hold the conenction result  //undefined until one of the if branches sets it 

    if(dbConfig.dbtype == 'MongoDB'){
        resp = await mongoDb.connect(dbConfig);
        //delegates to mongodb/mongoDB.js   //mongoDB.connect tries to establish connection 
        // returns: conenction object or success indicator 
    }else if(dbcConfig.dbType == 'MySQL'){
        resp = await mysqlDb.connect(dbConfig);
        //delegates to mysql/mysql.js
    }else if(dbConfig.dbType == 'PostgreSQL'){
        resp = await postgresql.connect(dbConfig);
        // delegates to postgresql/postgresql.js
    }else {
         throw new Error(`Unsupported database type: ${dbConfig.dbType}`);
     } 

     // Also: == instead of === (same issue as before)
    // Should use strict equality ===

    return resp;
    // Returns connection result to setupConfig()  //setupConfig() then saves config and returns to cli.js

        
    
};

let dump = async ( jobName, key, backupDirName) => {
// called from backup.js 
// let dbdump = await db.dump (jobName, key, newBackupPath);
// jobName = 'master' (which job)
//key = encryption key (to dycrypt config)
// backupDirName = 'Home/user/backups/master_backup_03-12-2026 (where to save th dump file)

    const jobConfStore = new configstore({configstore: jobName, encryptionkey: key});
    // opens encrypted config files for this job  //needs to know: which db type , host, port , credentials 

    const jobConfigObj = jobConfStore.store;
    // gets entire config as plain object  //db type: 'MySQL', dbhost: 'local host', db port: '3306',..}

    let resp;
    if (dbType == 'MongoDB'){
        resp = await mongoDb.dump(jobConfigObj, key, backupDirName);
        //mongo dump:
        // internally runs mongo --host localhost --port 27017
                        // --db myDatabase --out /backups/...
                        //industry term : "mongodump" --official mongodb backup utility 
    

    }else if (dbType == 'MySQL'){
        resp = await mysqlDb.dump(jobConfigObj, key, backupDirName);
        //Mysql dump: internally runs: ,mysqldump -h localhost -P 3306 
        //                          -u root -p mymyDatabase > backup.sql 
        //industry term: "mysqldump" - official Mysql backup utility 

    }else if (dbType== 'PostgreSQL'){
        resp = await postgresql.dump(jobConfigObj, key , backDirName);
        //postgresql dump:
        // inernally runs: pg_dump -h localhost -p 5432
                                // -U postgresmyDatabase > backup.sql
                                //industry term : "pg_dump" - official postgresql back up utility                                
    }
//    // ⚠️ BUG: Same missing else clause as connect()
    // Unknown dbType → resp = undefined → backup silently "succeeds"
    // But no actual backup file was created!
    // This is worse than connect() bug — data loss risk

    return resp;
    // returns dump result to backup.js
    //backup.j uses this to confirm dump succeeded
};

let setRestore = async (jobName, key, isDebug) => {
    //called from cli.js whe nuser runs: guarddb restore 

    const jobConfStore = new configstore({configName: jobName, encryptionkey: key});
    const jobConfObj = jobConfStore.store;
    //Load job COnfig - needs DB credentials to connect for restore 

    let restoreStatus = ora ('Restoring, please wait..');
    //spinner for restore operation 
    //restore can take a Long time for large database 

    try{
        let restoreConfig = await inquirer.askRestoreConfig(jobName, key);
        //shows interactive prompts :
        //?Select backup to restore from: (lists available backups)
        //master_backup_03-11-2026
        // '''''''
        //?are you sure want to restore? this will overwrite current data(y/n)?

        //returns {
        // backupfilename: 'master_backup_03-11-2026,
        // restoreCOnfirmation: true/false

        if (restoreConfig.restoreCOnfirmation){
            //user confirmed they want to restore 
            //if false:user said no -> skip restore -> funstion ends quietly 

            let backupFilename = restoreConfig.backupFileName;
            //master_backup_03-11-2026
            // the specific backup folder to restore from 

            restoreStatus.start();
            //start spinner now - about to do the actual restore
            //only start after confirmation - no point showing spinner
            // /if users says no

            let dbRestoreRes = await restoreConfig(jobConfObj, key, backupFileName);
            //calls restore () function below 
            //restore () routes to correct DB sepcialists 
            //this is actual heavy operation 

            restoreStatus.succedd('Restore Success');
            //restore success 

            return dbRestoreRes;
            //Returns results to cli.js
        } 

        //if restore confirmation = false: falls through silently 
        // no error, no message - just exits
        //UI ISSUE - should probably say "restore cancelled"

        }catch (error){
            //note: use 'error' not 'err' - inconsistent with setupConfig above 
            // both works but inconsistency makes it harder to read 
            //industry term, "naming convention" - be consistent thorughout 

            restoreStatus.fail('Restore failed');
        console.error('Restoration of database from the backup failed.');
        console.error(`${error.name}: ${error.message}`);
        console.error('Re run with --restore to restore the backup');

            if(isDebug){
                console.error('Stacktrace:');
                console.error(error);
            }else{
                console.error(strings.debugModeDesc);
            }
            //same error handling pattern as setupConfig
            //Consistent - gooa practice

        
    }
};

let restore = async (dbConfig, key, backFileName) => {
    let resp;
    const dbType = dbConfig.dbType;
    //Read dbType from config

    if(dbType == 'MongoDB'){
        resp = await mongoDb.restore(dbConfig, key, backupFileName);
        //mongorestore command internally //industry term: "mongostore" - MongoDB's restore utility


    }else if(dbType == 'MySQL'){
        resp = await mysqlDb.restore(dbConfig, key , bacnkupFileName);
        //mysql command with SQL file piped in:
        //mysql -h host -u user -p database < backup.sql

    }else if(dbType == 'PostgreSQL'){
        resp = await postgresql.restore(dbConfig, key, backupFileName);
        //pg_restore or psql command 
    }

    //Bug: same missing else clause - third time !
    //pattern: every routing function lacks a default/fallback

    return resp;
};

module.exports ={
    setupConfig, //cli.js calls this -> setup DB Config
    connect, // exported but cli.js uses it indrectly via setups
    dump, //backup.js calls this -> daily backup
    setupRestore, //cli.js calls this -> disaster recovery 

    //note: restore() is not exported - its a private helper
    //only setupRestore() is public - it handles the full flow
    //restor() is an internal detail nobody outside needs to call direclty 

};