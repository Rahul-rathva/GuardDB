const { google } = require('googleapis');
const configstore = require('conf');
const fs = require('fs');

// ─────────────────────────────────────────────────────────────
// WHAT THIS FILE DOES:
// Google Drive specialist — handles all Google Drive operations
// Uses Google Drive API v3 via the 'googleapis' npm package
//
// Authentication method: Service Account + JWT
// Service Account = a Google account for apps (not humans)
// JWT = JSON Web Token — proves identity to Google API
// Industry term: "Service Account Authentication"
// ─────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────
// FUNCTION 1: init()
// Creates and returns an authenticated Google Drive client
// Called internally before every Drive operation
// NOT meant for external use but exported for flexibility
// ─────────────────────────────────────────────────────────────

const init = (jobName, key, googleCreds = undefined) => {
    const jobConfStore = new configstore({configName: jobName, encryptionKey: key});

    if (!googleCreds) {
        // No credentials passed — load from saved config
        // This is used during normal backup/delete operations
        // Credentials were saved during setup via cloneServiceAccKey()
        googleCreds = jobConfStore.store;
    } else {
        // Credentials object passed — load the JSON key file from path
        // This is used during SETUP before credentials are saved
        // googleCreds.gDriveServiceAccKeyLoc = '/path/to/key.json'
        googleCreds = require(googleCreds.gDriveServiceAccKeyLoc);
        // require() on a JSON file parses it automatically
        // Returns the service account key object:
        // {
        //   client_email: 'myapp@project.iam.gserviceaccount.com',
        //   private_key: '-----BEGIN RSA PRIVATE KEY-----...',
        //   project_id: 'my-project',
        //   ...
        // }
    }

    // Define what permissions we need from Google
    // 'drive' scope = full read/write access to Google Drive
    // Industry term: "OAuth scopes" — specific permissions requested
    // Principle of least privilege: request only what you need
    const scopes = ['https://www.googleapis.com/auth/drive'];

    // Create JWT auth client using service account credentials
    // JWT = JSON Web Token — signs requests to prove identity
    // Parameters:
    //   client_email = identifies WHICH service account
    //   null         = keyFile (not used when passing private_key directly)
    //   private_key  = signs the JWT — proves we own this service account
    //   scopes       = what permissions we're requesting
    const gDriveAuth = new google.auth.JWT(
        googleCreds.client_email,
        null,
        googleCreds.private_key,
        scopes
    );

    // Create and return authenticated Drive API client
    // version: 'v3' = Google Drive API version 3 (current)
    // auth: gDriveAuth = use our JWT auth for all requests
    const drive = google.drive({ version: 'v3', auth: gDriveAuth });
    return drive;
    // ⚠️ ORIGINAL BUG: return (drive = google.drive(...))
    // Was assigning to an implicit global variable 'drive'
    // In strict mode this would throw ReferenceError
    // Fixed: assign to const then return
};

// ─────────────────────────────────────────────────────────────
// FUNCTION 2: cloneServiceAccKey()
// Copies Google Service Account key INTO the encrypted config
// Called during setup after user provides key file path
// Why? Key file could be anywhere — copy it to secure config
// ─────────────────────────────────────────────────────────────

const cloneServiceAccKey = async (jobName, key, serviceKeyLoc) => {
    const jobConfStore = new configstore({configName: jobName, encryptionKey: key});

    // Load the service account JSON key file
    const googleCreds = require(serviceKeyLoc);
    // googleCreds = {
    //   type: 'service_account',
    //   client_email: 'app@project.iam.gserviceaccount.com',
    //   private_key: '-----BEGIN RSA PRIVATE KEY-----...',
    //   project_id: 'my-project',
    //   ...
    // }

    // Save the entire key file contents into encrypted config
    // Now the key is stored securely — original file not needed
    // init() can load credentials directly from config (no googleCreds param)
    jobConfStore.set(googleCreds);
    // ⚠️ ORIGINAL: return await jobConfStore.set(googleCreds)
    // configstore.set() is synchronous — not a Promise
    // await on a non-Promise = unnecessary but harmless
    // Fixed: remove unnecessary await and return

    return true;
    // Return true to confirm success
    // remoteSync.js checks this result
};

// ─────────────────────────────────────────────────────────────
// FUNCTION 3: listFolders()
// Lists all folders in the Google Drive account
// Called during setup to show user which folder to backup to
// ─────────────────────────────────────────────────────────────

const listFolders = async (jobName, key, gdConfig) => {
    // Initialize Drive client with provided config
    // gdConfig passed during setup (before credentials saved)
    const drive = init(jobName, key, gdConfig);

    // Query Google Drive for all folders
    // q = search query using Drive's query language
    // mimeType filter: only return folder type items
    // Google Drive folders have this specific MIME type
    // Industry term: "MIME type" — identifies file/content type
    // application/vnd.google-apps.folder = Google Drive folder
    const res = await drive.files.list({
        q: "mimeType = 'application/vnd.google-apps.folder'",
    });

    const files = res.data.files;
    // res.data.files = array of folder objects:
    // [
    //   { id: '1abc234', name: 'Backups', ... },
    //   { id: '5def678', name: 'Projects', ... }
    // ]

    return files;
    // Returned to remoteSync.js which maps to:
    // [{ name: 'Backups', value: '1abc234' }]
    // For display in inquirer folder picker
};

// ─────────────────────────────────────────────────────────────
// FUNCTION 4: uploadFile()
// Uploads a backup file to Google Drive
// Called from backup.js after every successful backup
// ─────────────────────────────────────────────────────────────

const uploadFile = async (jobName, key, fileName, filePath) => {
    const jobConfStore = new configstore({configName: jobName, encryptionKey: key});

    // Initialize Drive client using saved credentials
    // No gdConfig param = loads credentials from saved config
    const drive = init(jobName, key);

    // Upload file to Google Drive
    const res = await drive.files.create({
        requestBody: {
            name: fileName,
            // Display name in Google Drive
            // e.g., 'master_backup_03-12-2026'

            mimeType: 'application/x-gzip',
            // MIME type tells Drive what kind of file this is
            // application/x-gzip = gzip compressed file
            // ⚠️ HARDCODED: Always sets gzip MIME type
            // Even if backup is not compressed or is encrypted
            // Should dynamically set based on actual file type

            parents: [jobConfStore.get('gDriveParentFolderId')],
            // Array of parent folder IDs
            // gDriveParentFolderId = folder user selected during setup
            // File will appear inside this folder in Drive
        },
        media: {
            mimeType: 'application/x-gzip',
            // Same MIME type for the media upload
            body: fs.createReadStream(filePath),
            // fs.createReadStream = reads file in chunks
            // More memory efficient than reading entire file at once
            // Industry term: "Streaming upload" — send data as it's read
            // Critical for large backup files — prevents memory issues
        },
    });

    // Save the uploaded file's Drive ID to config
    // Key = fileName, Value = Drive file ID
    // Example: { 'master_backup_03-12-2026': '1xyz789abc' }
    // Needed later for deleteFile() — Drive needs ID not name to delete
    jobConfStore.set({ [res.data.name]: res.data.id });
    // [res.data.name] = computed property key
    // Uses the file name as the key dynamically

    return res;
};

// ─────────────────────────────────────────────────────────────
// FUNCTION 5: deleteFile()
// Deletes a backup file from Google Drive
// Called from backup.js to clean old cloud backups
// ─────────────────────────────────────────────────────────────

const deleteFile = async (jobName, key, fileName) => {
    const jobConfStore = new configstore({configName: jobName, encryptionKey: key});
    const drive = init(jobName, key);

    // Look up the Drive file ID by fileName
    // We saved this mapping during uploadFile()
    // { 'master_backup_03-12-2026': '1xyz789abc' }
    const fileId = jobConfStore.get(fileName);
    // ⚠️ No check if fileId exists
    // If fileName was never uploaded or already deleted:
    // fileId = undefined → drive.files.delete({ fileId: undefined })
    // → Google API throws error
    // Fix: if (!fileId) throw new Error(`File ID not found for: ${fileName}`)

    // Delete the file from Google Drive using its ID
    // Google Drive requires file ID (not name) for deletion
    // This is why we saved the ID mapping during upload
    const res = await drive.files.delete({ fileId: fileId });

    // Remove the ID mapping from local config
    // File is gone from Drive — no point keeping the ID
    jobConfStore.delete(fileName);

    return res;
};

module.exports = {
    init,
    cloneServiceAccKey,
    listFolders,
    uploadFile,
    deleteFile,
};