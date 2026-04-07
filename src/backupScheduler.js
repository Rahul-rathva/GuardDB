const backupDB  = require('./backup');
//loads backup & we need it because this file is responsible for calling the backup.
//specifically : backupDB .backup check() is what runs at scheduled time. backupcheck does the dump, deleted old backup and send email report

const cron = require('node-cron');
// node cron is npm package for scheduling tasks;works exacctly like the unix cron - the standard linux task scheduler 
//used in every inndustry: banks run batch jobs, web servers run maintenance tasks, etc.
//emails get sent in bulk - all using cron style scheduling; node- cron brings this power into node.js application 

const strings = require('./utils/strings');
// all texts shown to the user // used here for : strings.synchlystarteddesc - startup message 
// strings. jobconfiglog - pre-job config summary // stringsenablejobwarning - warning when no jobs are enable 

const configstore = require('conf');
// encrypted config store - same as used in cli.js  and backup.js // used here for read the each jobs setting 
//(backup timings,db details etc) // we need backup time to know when to schedule each job 


let cronScheduler = (jobNames, key, isDebug) => {
    //not async operation - cron is not a promised based operation ,it just registers timer and returns immediately 

    console.log(strings.synchlyStartedDesc);
    // prints the startup banner at the terminal //users know the system is alive

    for (let i in jobNames){
        //for ....in loop over the jobnames array // i= '0','1','2','3'.. indicating stringg indices and not numbers 

        const currentJob = jobNames[i];
        //gets the actual job name string // example: first iteration master , second iteration work 

        const jobConfStore = new configstore({configName: currentJob, encryptionKey: key });
        //open this encrypted config file// // configName: 'master' → looks for master.json in config directory
        // encryptionKey: key   → decrypts it using the master key
        // If key is wrong or null: config will be unreadable (returns empty or garbage)
        
        const jobConfObj = jobConfStore.store;
        console.log(strings.jobConfigLog(currentJob, jobcconfObj));

        const backUp
    }
}