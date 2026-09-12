const AWS = require('aws-sdk');
const configstore = require('conf');
const fs = require('fs');

// ─────────────────────────────────────────────────────────────
// WHAT THIS FILE DOES:
// AWS S3 specialist — handles all Amazon S3 operations
// S3 = Simple Storage Service — Amazon's cloud object storage
// Used by Netflix, Airbnb, Reddit — industry standard cloud storage
//
// Uses aws-sdk npm package — Amazon's official Node.js SDK
// SDK = Software Development Kit — library for talking to AWS APIs
// ─────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────
// FUNCTION 1: init()
// Creates authenticated AWS S3 client
// Similar to gDrive init() — builds API client with credentials
// ─────────────────────────────────────────────────────────────

const init = (jobName, key, awsCreds = undefined) => {
    const jobConfStore = new configstore({configName: jobName, encryptionKey: key});

    if (!awsCreds) {
        awsCreds = jobConfStore.store;
        // Load from saved encrypted config
        // Used during normal backup/delete operations
    } else {
        awsCreds = require(awsCreds.s3AccKeyLoc);
        // Load AWS credentials from JSON file path
        // AWS credentials file format:
        // {
        //   "aws_access_key_id": "AKIAIOSFODNN7EXAMPLE",
        //   "aws_secret_access_key": "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
        //   "region": "us-east-1"
        // }
    }

    // Create authenticated S3 client
    const s3Auth = new AWS.S3({
        accessKeyId: awsCreds.aws_access_key_id,
        // AWS Access Key ID — identifies your AWS account
        // Like a username for AWS API access

        secretAccessKey: awsCreds.aws_secret_access_key,
        // AWS Secret Access Key — proves you own the access key
        // Like a password — never share or commit to git

        region: awsCreds.region,
        // AWS region where your S3 buckets are located
        // e.g., 'us-east-1', 'ap-south-1', 'eu-west-1'
        // Industry term: "AWS Region" — geographic area of AWS data centers
    });

    return s3Auth;
};

// ─────────────────────────────────────────────────────────────
// FUNCTION 2: cloneServiceAccKey()
// Copies AWS credentials INTO encrypted config
// Same purpose as gDrive.cloneServiceAccKey()
// ─────────────────────────────────────────────────────────────

const cloneServiceAccKey = async (jobName, key, serviceKeyLoc) => {
    const jobConfStore = new configstore({configName: jobName, encryptionKey: key});
    const awsCreds = require(serviceKeyLoc);
    // Load AWS credentials JSON file from provided path

    jobConfStore.set(awsCreds);
    // Save credentials into encrypted config
    // configstore.set() is synchronous — no await needed

    return true;
    // Return true to confirm success
    // remoteSync.js checks this result
};

// ─────────────────────────────────────────────────────────────
// FUNCTION 3: listFolders()
// Lists "folders" (prefixes) inside an S3 bucket
// S3 has no real folders — uses / in key names to simulate them
// ─────────────────────────────────────────────────────────────

const listFolders = async (jobName, key, s3Config) => {
    const s3 = init(jobName, key, s3Config);

    const s3params = {
        Bucket: s3Config.s3ParentBucket,
        // Which bucket to list folders in
        // e.g., 'my-company-backups'

        MaxKeys: 20,
        // Maximum number of items to return
        // Limits results — prevents huge responses for large buckets

        Delimiter: '/',
        // Groups objects by common prefix up to first /
        // 'guarddb/master/file.sql' → CommonPrefix: 'guarddb/'
        // This simulates folder listing in S3
        // Industry term: "S3 delimiter" — groups objects by prefix
    };

    const folders = await s3.listObjectsV2(s3params).promise();
    // .promise() converts AWS SDK callback to Promise
    // Same concept as mysql's promisification but AWS SDK does it for us
    // listObjectsV2 = newer version of listObjects API

    // Extract folder names from CommonPrefixes
    const folder = [];
    for (let i = 0; i < folders.CommonPrefixes.length; i++) {
        // CommonPrefixes = array of prefix objects:
        // [{ Prefix: 'guarddb/' }, { Prefix: 'backups/' }]
        folder.push({ Name: folders.CommonPrefixes[i].Prefix });
        // Normalize to { Name: 'guarddb/' } format
        // Matches format expected by remoteSync.js mapping
    }

    return folder;
};

// ─────────────────────────────────────────────────────────────
// FUNCTION 4: listBuckets()
// Lists all S3 buckets in the AWS account
// Called during setup to show available buckets
// ─────────────────────────────────────────────────────────────

const listBuckets = async (jobName, key, s3Config) => {
    const s3 = init(jobName, key, s3Config);

    const { Buckets } = await s3.listBuckets().promise();
    // listBuckets() returns: { Buckets: [...], Owner: {...} }
    // Destructure to get just the Buckets array
    // Each bucket: { Name: 'my-backups', CreationDate: '2024-01-01' }

    return Buckets;
    // remoteSync.js maps to: [{ name: 'my-backups' }]
    // For display in inquirer bucket picker
};

// ─────────────────────────────────────────────────────────────
// FUNCTION 5: uploadFile()
// Uploads backup file to AWS S3 bucket
// Called from backup.js after every successful backup
// ─────────────────────────────────────────────────────────────

const uploadFile = async (jobName, key, fileName, filePath) => {
    const jobConfStore = new configstore({configName: jobName, encryptionKey: key});
    const s3 = init(jobName, key);

    const fileContent = fs.readFileSync(filePath);
    // Read entire file into memory
    // ⚠️ MEMORY ISSUE: readFileSync loads whole file into RAM
    // For large backups this could cause out-of-memory errors
    // Better: use fs.createReadStream(filePath) like gDrive does
    // Streams file in chunks — memory efficient

    const params = {
        Bucket: jobConfStore.get('s3ParentBucket'),
        // Which bucket to upload to
        // e.g., 'my-company-backups'

        Key: jobConfStore.get('s3ParentFolder') + fileName,
        // S3 object key = full path within bucket
        // s3ParentFolder = 'guarddb/'
        // fileName       = 'master_backup_03-12-2026'
        // Key            = 'guarddb/master_backup_03-12-2026'
        // This is what looks like a "file path" in S3

        Body: fileContent,
        // File contents to upload
    };

    const res = await s3.upload(params).promise();
    // s3.upload() handles multipart upload automatically
    // Multipart = splits large files into chunks for reliable upload
    // Industry term: "Multipart upload" — S3 feature for large files
    // .promise() converts callback to Promise

    return res;
};

// ─────────────────────────────────────────────────────────────
// FUNCTION 6: deleteFile()
// Deletes old backup file from AWS S3
// Called from backup.js to clean old remote backups
// S3 deletions are immediate and permanent — no trash bin
// ─────────────────────────────────────────────────────────────

const deleteFile = async (jobName, key, fileName) => {
    const jobConfStore = new configstore({configName: jobName, encryptionKey: key});
    const s3 = init(jobName, key);

    const params = {
        Bucket: jobConfStore.get('s3ParentBucket'),
        Key: jobConfStore.get('s3ParentFolder') + fileName,
        // Same key construction as uploadFile
        // Must match exactly — wrong key = wrong file deleted
    };

    const res = await s3.deleteObject(params).promise();
    // deleteObject() permanently removes the S3 object
    // No recovery possible after this
    return res;
};

module.exports = {
    init,
    cloneServiceAccKey,
    listFolders,
    listBuckets,
    uploadFile,
    deleteFile,
};