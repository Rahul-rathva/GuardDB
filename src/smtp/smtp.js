const nodemailer = require('nodemailer');
const configstore = require('conf');
const strings = require('./../utils/strings');
const date = require('./../utils/date');
const cron = require('node-cron');
const ora = require('ora');
const inquirer = require('./inquirer');
const validator = require('./validator');

// ─────────────────────────────────────────────────────────────
// WHAT THIS FILE DOES:
// Handles all email notification functionality
// Sends status reports after every backup attempt
// Uses nodemailer — most popular Node.js email library
// Uses SMTP protocol — the universal email sending standard
//
// SMTP = Simple Mail Transfer Protocol
// The protocol ALL email servers use to send mail
// Gmail, Outlook, Yahoo all support SMTP
// Like a postal service for emails
//
// Three main functions:
// setupConfig()       → configure SMTP settings, send test email
// sendMail()          → actually sends one email
// sendMailScheduler() → schedules email to send at right time
// ─────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────
// FUNCTION 1: setupConfig()
// Sets up SMTP email configuration
// Called when user runs: guarddb --config smtp
// Tests connection by sending a real test email
// ─────────────────────────────────────────────────────────────

const setupConfig = async (jobName, key, isDebug, filePath = undefined) => {
    const jobConfStore = new configstore({configName: jobName, encryptionKey: key});
    const smtpConnStatus = ora('Authenticating you, please wait...');

    try {
        let config;

        if (filePath) {
            // Load from JSON file (--file flag)
            config = require(filePath);
            smtpConnStatus.start();
            config = await validator.validateInitConfig(config);
        } else {
            // Interactive prompts
            config = await inquirer.askConfig(jobName, key);
            smtpConnStatus.start();
        }

        // Test SMTP connection by sending a real email
        // If email fails: credentials are wrong → throw error
        const testEmailSub = 'SMTP configuration update successful';
        // ⚠️ ORIGINAL TYPO: 'updation successfull'
        // 'updation' is not standard English — use 'update'
        // 'successfull' has double l — fixed to 'successful'

        const testEmailBody = `Status notifications will be sent every day to:<br/> ${config.smtpRecipientMail}`;
        // ⚠️ ORIGINAL: 'everyday' — incorrect, should be 'every day'
        // 'everyday' = adjective (an everyday occurrence)
        // 'every day' = adverb (happens every day)

        const smtpConnRes = await sendMail(
            jobName,
            key,
            testEmailSub,
            testEmailBody,
            config
        );
        // Sends actual test email to recipient
        // If SMTP host/port/credentials wrong → throws here
        // User receives a real email confirming setup worked

        smtpConnStatus.succeed('Authentication success');
        // ⚠️ ORIGINAL TYPO: 'Authentication succeess' (extra e)
        // Fixed: 'Authentication success'

        config.smtpSetupComplete = true;
        // Mark setup as complete
        // cli.js checks this before allowing --enable smtp

        jobConfStore.set(config);
        // Save all SMTP settings to encrypted config
        // smtpHost, smtpPort, smtpUser, smtpPwd,
        // smtpSenderMail, smtpRecipientMail, smtpNotifyTime

        console.log('SMTP configuration updated successfully.');
        return config;

    } catch (err) {
        smtpConnStatus.fail('Authentication failed');
        console.error('SMTP configuration update failed.');
        console.error(`${err.name}: ${err.message}`);
        console.error('Re run with --config smtp to finish the configuration');
        if (isDebug) {
            console.error('Stacktrace:');
            console.error(err);
        } else {
            console.error(strings.debugModeDesc);
        }
    }
};

// ─────────────────────────────────────────────────────────────
// FUNCTION 2: init()
// Creates a nodemailer SMTP transport (connection)
// Called by sendMail() before every email send
// NOT exported — private helper
// ─────────────────────────────────────────────────────────────

const init = (jobName, key, smtpConfig = undefined) => {
    const jobConfStore = new configstore({configName: jobName, encryptionKey: key});
    if (!smtpConfig) smtpConfig = jobConfStore.store;

    // nodemailer.createTransport() creates an SMTP connection
    // Industry term: "SMTP transport" — the connection channel
    // Like creating a phone line before making a call
    return nodemailer.createTransport({
        host: smtpConfig.smtpHost,
        // SMTP server hostname
        // Gmail:   smtp.gmail.com
        // Outlook: smtp.office365.com
        // Yahoo:   smtp.mail.yahoo.com

        port: smtpConfig.smtpPort,
        // SMTP port number:
        // 465 = SMTP over SSL (secure, older standard)
        // 587 = SMTP with STARTTLS (secure, modern standard)
        // 25  = plain SMTP (not secure, often blocked)

        secure: smtpConfig.smtpPort == 465,
        // true  = use SSL directly (port 465)
        // false = use STARTTLS upgrade (port 587/25)
        // Automatically set based on port number
        // Industry term: "SSL vs STARTTLS"
        // SSL: encrypted from start
        // STARTTLS: starts plain, upgrades to encrypted
        // ⚠️ == instead of === (minor)

        auth: {
            user: smtpConfig.smtpUser,
            // Email account username (usually the email address)
            pass: smtpConfig.smtpPwd,
            // Email account password or app-specific password
            // Gmail requires "App Password" not account password
            // when 2FA is enabled
        },
    });
};

// ─────────────────────────────────────────────────────────────
// FUNCTION 3: sendMail()
// Actually sends one email via SMTP
// Called by setupConfig() for test email
// Called by sendMailScheduler() for daily status reports
// ─────────────────────────────────────────────────────────────

const sendMail = async (jobName, key, subject, htmlBody, smtpConfig = undefined) => {
    const jobConfStore = new configstore({configName: jobName, encryptionKey: key});
    if (!smtpConfig) smtpConfig = jobConfStore.store;

    // Create SMTP transport connection
    const smtpTransport = init(jobName, key, smtpConfig);

    // Build email options
    const mailOptions = {
        from: `GuardDB Backups <${smtpConfig.smtpSenderMail}>`,
        // ⚠️ ORIGINAL: 'Synchly backups' — renamed to match our project
        // Format: "Display Name <email@address.com>"
        // Display name shown in recipient's email client

        to: smtpConfig.smtpRecipientMail,
        // Who receives the backup status email
        // Configured during smtp setup

        generateTextFromHTML: true,
        // Auto-generate plain text version from HTML body
        // Good practice: send both HTML and plain text
        // Some email clients don't render HTML

        subject: subject,
        // Email subject line
        // e.g., 'Daily Status Report' or 'SMTP configuration update successful'

        html: htmlBody,
        // HTML email body
        // Can contain: tables, colors, formatting
        // strings.statusReportTemplate() generates this
    };

    const res = await smtpTransport.sendMail(mailOptions);
    // Actually sends the email via SMTP
    // await: waits for SMTP server to accept the message
    // Returns: { messageId, accepted, rejected, ... }

    smtpTransport.close();
    // Close the SMTP connection after sending
    // Important: leaving transport open wastes resources
    // Like hanging up the phone after a call

    return res;
};

// ─────────────────────────────────────────────────────────────
// FUNCTION 4: sendMailScheduler()
// Schedules the status email to send at the configured time
// Called from backup.js after every backup attempt
// Uses smart scheduling: if notify time already passed today,
// send in 1 minute instead of waiting until tomorrow
// ─────────────────────────────────────────────────────────────

const sendMailScheduler = (jobName, key, subject, htmlBody, isDebug) => {
// NOT async — cron.schedule() is synchronous (just registers a timer)
// The actual email sending is async inside the callback

    const jobConfStore = new configstore({configName: jobName, encryptionKey: key});
    const jobConfigObj = jobConfStore.store;

    // Get configured notification time
    const smtpNotifyTime = new Date(jobConfigObj.smtpNotifyTime);
    const notifyHours = smtpNotifyTime.getHours();
    const notifyMinutes = smtpNotifyTime.getMinutes();
    let cronExp = `${notifyMinutes} ${notifyHours} * * *`;
    // Normal schedule: send at configured time every day
    // e.g., "30 8 * * *" = every day at 8:30 AM

    const dbBackupTime = new Date(jobConfigObj.dbBackupTime);
    // When the backup runs
    // Used to check if notification time has already passed

    // SMART SCHEDULING: check if notify time is missed
    const isNotifyMissed = date.isBetween(smtpNotifyTime, dbBackupTime, new Date());
    // isBetween(checkTime, start, end)
    // Returns true if smtpNotifyTime is between dbBackupTime and now
    // Meaning: backup ran AFTER the notification time today
    // So today's notification slot has already passed
    //
    // Example:
    // Backup runs at:  2:30 AM
    // Notify time set: 3:00 AM (30 min after backup)
    // Current time:    3:15 AM
    // isNotifyMissed = true (3:00 AM already passed)
    // → Send in 1 minute instead

    if (isNotifyMissed) {
        cronExp = `*/1 * * * *`;
        // Run every 1 minute until sent
        // */1 = every 1 minute
        // This ensures email is sent ASAP when notify time is missed
        // The task destroys itself after first send (see below)
    }

    const sendMailTask = cron.schedule(cronExp, async () => {
        try {
            await sendMail(jobName, key, subject, htmlBody, jobConfigObj);
            // Send the actual status email

        } catch (e) {
            console.error(`smtp: failed to send status mail: ${e.message}`);
            if (isDebug) {
                console.error('Stacktrace:');
                console.error(e);
                // ⚠️ ORIGINAL BUG: console.error(err) — 'err' not defined
                // catch variable is 'e' not 'err'
                // Fixed: console.error(e)
            } else {
                console.error(strings.debugModeDesc);
            }
        }

        // Stop and destroy the task after first execution
        // One-shot scheduler — sends once then cleans up
        // Without this: email would keep sending every day
        // with the same backup status (stale data)
        sendMailTask.stop();
        // stop() = prevents future executions

        sendMailTask.destroy();
        // destroy() = completely removes the cron task
        // Frees memory and resources
        // Industry term: "One-shot task" — runs once then removes itself
    });
};

module.exports = {
    setupConfig,
    sendMail,
    sendMailScheduler,
    // init NOT exported — private helper
};