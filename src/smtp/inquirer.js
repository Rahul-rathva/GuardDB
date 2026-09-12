const inquirer = require('inquirer');
const configstore = require('conf');
const utils = require('./../utils/utils');

// ─────────────────────────────────────────────────────────────
// WHAT THIS FILE DOES:
// SMTP specific setup prompts
// Called when user runs: guarddb --config smtp
// Asks for all email server settings needed to send notifications
// ─────────────────────────────────────────────────────────────

// Register datetime prompt ONCE at file level
// Not inside function — prevents re-registration on every call
inquirer.registerPrompt('datetime', require('inquirer-datepicker-prompt'));

const askConfig = async (jobName, key) => {
    const jobConfStore = new configstore({configName: jobName, encryptionKey: key});
    const jobConfigObj = jobConfStore.store;
    // Load existing config for pre-filling defaults

    const questions = [];

    // QUESTION 1: SMTP Hostname
    questions.push({
        name: 'smtpHost',
        type: 'input',
        message: 'Enter your SMTP hostname:',
        default: jobConfigObj.smtpHost,
        // Examples: smtp.gmail.com, smtp.office365.com
        validate: (value) => {
            if (value.length) return true;
            return 'Please enter the SMTP hostname.';
        },
    });

    // QUESTION 2: SMTP Port (list selection not free text)
    questions.push({
        name: 'smtpPort',
        type: 'list',
        message: 'Choose your SMTP port:',
        choices: [465, 587, 25],
        // 465 = SSL (secure, recommended)
        // 587 = STARTTLS (secure, modern)
        // 25  = plain (not secure, often blocked by ISPs)
        default: jobConfigObj.smtpPort || 465,
        // ⚠️ ORIGINAL: two default properties on same object
        // JavaScript silently uses the LAST one
        // Fixed: single default with fallback to 465
    });

    // QUESTION 3: SMTP Username
    questions.push({
        name: 'smtpUser',
        type: 'input',
        message: 'Enter the SMTP username:',
        default: jobConfigObj.smtpUser,
        // Usually the full email address: user@gmail.com
        validate: (value) => {
            if (value.length) return true;
            return 'Please enter the SMTP username.';
        },
    });

    // QUESTION 4: SMTP Password
    questions.push({
        name: 'smtpPwd',
        type: 'password',
        mask: '*',
        // ⚠️ ORIGINAL: mask: true — should be character not boolean
        // Fixed: mask: '*'
        message: 'Enter the SMTP password:',
        // No default — never pre-fill passwords
        validate: (value) => {
            if (value.length) return true;
            return 'Please enter the SMTP password.';
        },
    });

    // QUESTION 5: Sender Email Address
    questions.push({
        name: 'smtpSenderMail',
        type: 'input',
        message: 'Enter the sender email address:',
        default: jobConfigObj.smtpSenderMail,
        // "From" address in the status emails
        validate: (value) => {
            if (!value.length) {
                return 'Please enter the sender email address.';
            }
            if (!utils.validateEmail(value)) {
                return 'Please enter a valid sender email address.';
            }
            return true;
            // utils.validateEmail() checks format: user@domain.com
            // Regex-based email validation
        },
    });

    // QUESTION 6: Recipient Email Address
    questions.push({
        name: 'smtpRecipientMail',
        type: 'input',
        message: 'Enter the recipient email address:',
        default: jobConfigObj.smtpRecipientMail,
        // "To" address — who receives backup status reports
        validate: (value) => {
            if (!value.length) {
                return 'Please enter the recipient email address.';
            }
            if (!utils.validateEmail(value)) {
                return 'Please enter a valid recipient email address.';
            }
            return true;
        },
    });

    // QUESTION 7: Notification Time (custom datetime picker)
    const smtpNotifyTimeString = jobConfigObj.smtpNotifyTime || '1970-01-01 00:00';
    questions.push({
        type: 'datetime',
        name: 'smtpNotifyTime',
        message: 'Enter the time to send status updates every day:',
        format: ['H', ':', 'MM', ' ', 'Z'],
        initial: new Date(smtpNotifyTimeString),
        // Time picker — same as backup time in database/inquirer.js
        // Sets WHEN the daily status email is sent
        // Usually set to shortly after the backup time
        // e.g., backup at 2:30 AM, notify at 3:00 AM
    });

    const smtpConfig = await inquirer.prompt(questions);
    return smtpConfig;
};

module.exports = {
    askConfig,
};