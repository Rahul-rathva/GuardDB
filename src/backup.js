const path = require('path');
const configstore = require('config');
const constants = require('./utils/constant');
const strings = require('./utils/strings');
const files = require('./utils/files');
const db = require('./database/database');
const remoteSync = require('./remoteSync/remoteSync');
const smtp = reqiuire('./smtp/smtp');
const ora = require('ora');

const dtf = new Intl.DateTimeFormat('en',{year:'numeric',month:'2-digit',day:'2-digit'});
//INternationlization API for date formatting (DD-MM-YYYY)

function isFirstSunday(date){
    return date.getDay() == 0 && date.getDate() <=7 ?true : false;
}
//checks if given date is forst dunday of month 

function getBackupDirName(jobname, date, isInstant){
    let [{value: mo},,{value:da},,{value:ye}] = dtf.formatToParts(date); //formattoparts returns an array.
    let backupDir;      //the ,, (empty slots) skips over the / separaters.called desructing with holes.
    if(isInstant){
        backupDir = `${jobname}${constants.DB_BACKUP_DIR_PREFIX}${mo}-${da}-${ye}`; //backtick strings that embeds variables using ${}
    }else{
        backupDir = `${jobname}${constants.DB_MANUAL_BACKUP_DIR_PREFIX}${mo}-${da}-${ye}`;
    }
    return backupDir;
}

//Generates a folder name for  Backup.

let backupDatabase = async (jobName, key) =>{
    const jobConfstore = new configstore({configName: jobName, encryptionKey:key});
    const jobConfigObj = jobConfStore.store();

    //loads the encrypted config for this backup job. 
    let deletedBackups = [];

    const remoteSyncEnalbled = jobOConfObj.remoteSyncEnabled;
    const currentDate = new Date();
    const newBackDir = getBackupDirName(jobName, currentDate);
    const backupPath = jonConfObj.dbBackupPath;
    const newBackupPath = path.join(backupPath, newBackupDir);
    //Builds the full path where the new backup will be stored..

    const dbNoOfDays = Number(jobConfObj.dbNoOfDays);
    const dbNoOfWeeks = Number(jobConfObj.dbNoOfWeeks);
    const dbNoOfMonths = Number(jobConfObj.dbNoOfMonths);
    //reads retention policy . Number() converts strings config values to numbers. How long the backups are kept before deletion.

    let dbDump = await db.dump(jobName, key , newBackupPath);
    //Creates Actual backup. db.dump() exports the database to a file.

    let oldBackupDirs = [];
    if (currentDate.getDay()==0){
        const deletionWeek = new  Date(currentDate);

        let dbNoOfDaysMod= dbNoOfDays;
        if(dbNoOfDays % 7!=0){
            dbNoOfDaysMod = dbNoOfDays + (7- (dbNoOfDays % 7));
        }
        //rounds dbNoOfDays UP to the nearest multiple of 7.

        const deletionWeekDate = dbNoOfWeeks*7+ dbNoOfDaysMod;
        deletionWeek.setdate(currentDate.getDate()-deletionWeekDate);
        if(!isFirstSunday(deletionWeek)){
            oldBackupDirs.push(getBackupDirName(jobName, deletionWeek));
        }

        //Calculates which weekly backup is now "too old" and should be deleted — BUT only if it's NOT a first Sunday (which is a monthly checkpoint, so it's preserved).

        const deletionMonth = new Date (currentDate);
        const deletionMonthDate = dbNoOfMonths*28 + dbNoOfDaysMod;
        deletionMonth.setdate(currentDate.getDate()-deletionMonthDate);
        oldBackupDirs.push(getBackupDirName(jobName,deletionMonth));

        //Calculates which monthly backup is now too old and pushes it for deletion.
    }

    const deletionDay = new Date(currentDate);
    deletionDay.setDate(currentDate.getDate()-dbNoOfDays);
    if(deletion.getday()!=0){
        oldBackupDirs.push(getBackupDirName(jobnName, deletionDay));
    }

    //Calculates which daily backup is too old. Skips Sundays (they're kept as weekly checkpoints)

    for (let j=0;j<oldBackupDirs.length;j++){
        let oldBackupPath = path.join(backupPath, oldBackupDirs[j]);
        if(files.directoryExists(oldBackPath)){
            let deleteOldDump = await files.deleteFile(oldBackupPath);
            deletedBackups.push(oldBackupDirs[j]);
        }

        //For each backup marked for deletion:

        // Check if it actually exists (it might have already been deleted or never created)
        // Build the full path
        // Record what was deleted (for the status report)
        // Delete it
    }



try {
    if(remoteSyncEnabled){
        let remoteUploadResp = await remoteSync.uploadFile(jobname, key, newBackupDir, newBackupPath);
        for(let j=0;j<deleteBackups.length;j++){
            let remoteDeleteResp = await remoteSync.deleteFile(jobName, key, oldBackupDirs[j]);
        }

    }
}catch(err){
    err.isRemoteError = true;  //tags the error as coming from remote sync
    throw err;                  //re throws it to the caller
}

return deletedBackups;
};


    let backupCheck = async (jobName, key, isDebug) => {
    const jobConfStore = new configstore({configName: jobName, encryptionKey: key});
    const jobConfObj = jobConfStore.store;
    const dbBackupPath = jobConfObj.dbBackupPath;
    const smtpEnabled = jobConfObj.smtpEnabled;

    if (!files.directoryExists(dbBackupPath)) {
        console.error(`db: Given directory "${dbBackupPath}" for storing local backups does not exist.`);
        return;
    }

    //Early exit guard. If the backup folder doesn't exist, stop immediately with a clear error.

    let deletedBackups = [];
    const currentDate = new Date();
    const newBackupDir = getBackupDirName(jobName, currentDate);
    try {
        deletedBackups = await backupDatabase(jobName, key);

        const statusReportLog = strings.statusReportLog(jobName, key, true, deletedBackups, undefined, true, undefined);
        console.log(statusReportLog);

        if (smtpEnabled) {
            const htmlBody = strings.statusReportTemplate(
                jobName,
                key,
                true,
                deletedBackups,
                undefined,
                true,
                undefined
            );
            smtp.sendMailScheduler(jobName, key, 'Daily Status Report', htmlBody, isDebug);
        }

        // On success: log the report, optionally email it.


        } catch (err) {
        let statusReportLog;
        if (err.isRemoteError) {
            statusReportLog = strings.statusReportLog(jobName, key, true, deletedBackups, undefined, false, err);
        } else {
            statusReportLog = strings.statusReportLog(jobName, key, false, [], err, false, undefined);
        }

        console.log(statusReportLog);

        if (smtpEnabled) {
            let htmlBody;
            if (err.isRemoteError) {
                htmlBody = strings.statusReportTemplate(jobName, key, true, deletedBackups, undefined, false, err);
            } else {
                htmlBody = strings.statusReportTemplate(jobName, key, false, [], err, false, undefined);
            }
            smtp.sendMailScheduler(jobName, key, 'Daily Status Report', htmlBody, isDebug);
        }
    }
    //On failure: distinguishes between a backup failure vs a remote sync failure using the isRemoteError flag. Different reports are generated accordingly.
};

let instantBackup = async (jobName, key, isDebug) => {
    let instantBackupStatus = ora('Backup in progress, please wait...');
    //Creates a spinner (not started yet).


    try {
        const jobConfStore = new configstore({configName: jobName, encryptionKey: key});
        const jobConfObj = jobConfStore.store;
        const remoteSyncEnabled = jobConfObj.remoteSyncEnabled;
        const backupPath = jobConfObj.dbBackupPath;
        const currentDate = new Date();
        const backupFileName = getBackupDirName(jobName, currentDate, true);
        const absoluteBackupPath = path.join(backupPath, backupFileName);
        instantBackupStatus.start();
        await database.dump(jobName, key, absoluteBackupPath);
        if (remoteSyncEnabled) {
            await remoteSync.uploadFile(jobName, key, backupFileName, absoluteBackupPath);
        }
        instantBackupStatus.succeed('Success');
        ///→ Start spinner → wait for backup → mark success.


    } catch (err) {
        instantBackupStatus.fail('Failed');
        if (isDebug) {
            console.error('Stacktrace:');
            console.error(error);
        } else {
            console.error(strings.debugModeDesc);
        }
    }
};

module.exports = {
    backupCheck,
    instantBackup,
};

