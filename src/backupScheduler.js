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

        const backUpTime = new Date (jonConfObj.dbBackupTime);
        //jobconfObj.dbBackuptime is Stored as a UNIX timestamp in milliseconds 
        //example : 170000000000 new Date(170000000000) → converts it to a human readable date object
        //industry term :UNIX timestamp or epoch time - number of milliseconds since 
        // uused universally in computing for time representation

        const backupHours = backupTime.getHours();
        //Extracts just the hour from the date object // example : if backupTime is 2024-11-14T02:00:00.000Z → getHours() returns 2
        //Example : Date  is 2:30 AM backupHours =2 
        //getHOurs() rerturn 0-23 (24 hours format)
        //0= midnight 12=noon 23=11 PM

        const backupMinutes = backupTime.getMinutes();
        //extracts just the minutes from the data object 
        //example : if backupTime is 2024-11-14T02:30:00.000Z → getMinutes() returns 30
        //getminutes()  return 0-59

        const cronExp = `${backupMinutes} ${backupHours} * * *`;
        //Builds a cron expression string using the extracted hours and minutes 
        //example : backup minutes = 30 backup hours = 2 -> "30 2 * * *"
        
        //CRON EXPRESSION FORMAT : (5 parts )
        // ┌──────── minute (0-59)
        // │  ┌───── hour (0-23)
        // │  │  ┌── day of month (1-31)
        // │  │  │  ┌─ month (1-12)
        // │  │  │  │  ┌ day of week (0-7, 0 and 7 = Sunday)
        // │  │  │  │  │
        // 30  2  *  *  *   ← means: "at 02:30, every day, every month"

        //* = any/every
        //so "30 2 * * *" means  at 02:30 AM every single day 

        //other examples : "0 9 * * 1" = every  monday at 9 am
        //"0 */6 * * *" = every 6 hours 
        //"0 0 1 * *" = first day of every month at midnight

        //industry term: cron expression - universal standard for defining 
        //schedules task timings .used in linux, github actions and AWS LAMBDA 
        //kubernetes cron jobs , databases- literally everywhere in tech 

        cron.schedule(cronExp, async () => {
            //cron schedule () takes two arguments :
            //1. cronExp when to run ("30 2 * * *")
            //2 call back function : what to run when the time comes 

            //this does not run immediately - it registers the task to run at 
            // the specified time in the future
            //the () => {....} is an arrow function (callback)
            //it gets called automatically by the node cron everyday at the set time 
            //insdustry term: "callback "- a function that you give to another function to call later when something happens 

            backupDBbackupCheck(currentJob, key, isDebug);
            // this is what runs every day at every time 
            // bsckup check from backup.js 
            //1 creates a new database dump (new backup file)
            //2 deletes old backup based on retention policy 
            //3 uploads to cloud if remotely syncecd
            //4 sends email report in SMTP enabled 

            //note : backupcheck is ASYNC but we're not awaitng it here !
            //BUG : missing await ::::::;;;;;"I'll debug it later after checking whether willl it work or not"
            //the cron callback is a regular function not async function 
            //should be :  cron.schedule(cronExp, async ()=> {})

                //without await : if backup handled throws an error , 
                // it becomes an unhandled PROMSIE REJECTION 
                //IN Older version of node.js silently ignores 
                //in newer version it can crash the entire process 
                // industry term : unhandles promise rejection one of the most common and dangerous bugs in Node.js production systems

        });
    }

    console.log(`Started ${jobNames.length} job(s)`);
    //prints started two job(s)
    //tells the user hom many jobs are now being monitored 
    // jobnames.length = number of enabled jobs passed from cli.js

    if(jobNames.length == 0 ) console.log(strings.enableJobsWarning);
    //if no jobs were eneabled warn the user 
    // strings. enableJobwarning = something like 
    //warning : mo jobs are enabled. use --enablejob to enable a job
    //this is important because Ux - without this warning , user would think 
    //everything is working fine but no backups would actaully run 

    //STYLE ISSUE : === instead of ==
    // in javascript  == checks value only (loose equality , does type conversion)
    // === checks values AND type (Strict equality and no conversion )

    //practice  ALWAYS use ===
    //jobNames.length is always a number so == works here
    //but === is standard here 

};


module.exports = cronScheduler;
//exports the functions directly (not as an object property )
//this is why in cli.js it is used as :
// backupScheduler (JobNames, key, isDebug )
// NOT backupScheduler.cronScheduler(..)
//compare with back up js which exports :module.exports = { backup Check , instantbackup}
//And is used as :
// backupDb.backupCheck(..)

//both are valid - direct exports vs named exports 
// industry term : "Module export Pattern "