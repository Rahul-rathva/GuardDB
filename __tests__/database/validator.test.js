// Import the function we want to test
const { validateInitConfig } = require('../../src/database/validator');
const path = require('path');
const fs = require('fs');

// 'describe' groups related tests together
// Like a folder for tests — "all tests about validateInitConfig"
describe('validateInitConfig', () => {

    // ─────────────────────────────────────
    // SETUP: Create a valid config to reuse
    // ─────────────────────────────────────
    
    // Create a temp directory for backup path testing
    const testBackupPath = path.join(__dirname, 'test-backups');
    
    beforeAll(() => {
        // beforeAll runs ONCE before all tests in this describe block
        // Create the test backup directory
        if (!fs.existsSync(testBackupPath)) {
            fs.mkdirSync(testBackupPath, { recursive: true });
        }
    });

    afterAll(() => {
        // afterAll runs ONCE after all tests complete
        // Clean up — remove the test directory we created
        if (fs.existsSync(testBackupPath)) {
            fs.rmdirSync(testBackupPath, { recursive: true });
        }
    });

    // A complete valid config — use this as base for all tests
    const validConfig = {
        databaseType: 'MySQL',
        username: 'root',
        password: 'secret123',
        host: 'localhost',
        port: '3306',
        databaseName: 'testdb',
        backupPath: testBackupPath,  // will be set in beforeAll
        enableCompression: true,
        backupTime: '02:30',
        noOfDailies: '7',
        noOfWeeklies: '4',
        noOfMonthlies: '3'
    };

    // ─────────────────────────────────────
    // TEST GROUP 1: Happy path (valid input)
    // ─────────────────────────────────────

    test('returns validated config for valid MySQL config', async () => {
        const result = await validateInitConfig(validConfig);
        
        // Check returned values are correct
        expect(result.dbType).toBe('MySQL');
        expect(result.dbAuthUser).toBe('root');
        expect(result.dbHost).toBe('localhost');
        expect(result.dbPort).toBe('3306');     // string
        expect(result.dbName).toBe('testdb');
        expect(result.dbIsCompressionEnabled).toBe(true);
        expect(result.dbNoOfDays).toBe('7');    // string
    });

    test('converts numeric port to string', async () => {
        const config = { ...validConfig, port: 3306 };  // number not string
        const result = await validateInitConfig(config);
        expect(result.dbPort).toBe('3306');  // should be string
        expect(typeof result.dbPort).toBe('string');
    });

    test('accepts MongoDB with authSource', async () => {
        const mongoConfig = {
            ...validConfig,
            databaseType: 'MongoDB',
            authSource: 'admin'
        };
        const result = await validateInitConfig(mongoConfig);
        expect(result.dbType).toBe('MongoDB');
        expect(result.dbAuthSource).toBe('admin');
    });

    // ─────────────────────────────────────
    // TEST GROUP 2: Missing required fields
    // ─────────────────────────────────────

    test('throws error when databaseType is missing', async () => {
        const config = { ...validConfig };
        delete config.databaseType;  // remove the field
        
        // expect(...).rejects.toThrow() = tests that an async function throws
        await expect(validateInitConfig(config))
            .rejects
            .toThrow("Missing required field - 'databaseType'");
    });

    test('throws error when username is missing', async () => {
        const config = { ...validConfig };
        delete config.username;
        
        await expect(validateInitConfig(config))
            .rejects
            .toThrow("Missing required field - 'username'");
    });

    test('throws error when password is missing', async () => {
        const config = { ...validConfig };
        delete config.password;
        
        await expect(validateInitConfig(config))
            .rejects
            .toThrow("Missing required field - 'password'");
    });

    // ─────────────────────────────────────
    // TEST GROUP 3: Invalid values
    // ─────────────────────────────────────

    test('throws error for unsupported database type', async () => {
        const config = { ...validConfig, databaseType: 'Oracle' };
        
        await expect(validateInitConfig(config))
            .rejects
            .toThrow("Unrecognised 'databaseType'");
    });

    test('throws error for invalid port (not a number)', async () => {
        const config = { ...validConfig, port: 'abc' };
        
        await expect(validateInitConfig(config))
            .rejects
            .toThrow("Not a valid 'port'");
    });

    test('throws error for port 0', async () => {
        const config = { ...validConfig, port: '0' };
        
        await expect(validateInitConfig(config))
            .rejects
            .toThrow("Not a valid 'port'");
    });

    // ─────────────────────────────────────
    // TEST GROUP 4: Boolean field validation
    // ─────────────────────────────────────

    test('throws error when enableCompression is a string not boolean', async () => {
        const config = { ...validConfig, enableCompression: 'true' };
        
        await expect(validateInitConfig(config))
            .rejects
            .toThrow("Expected a boolean but got a 'string'");
    });

    test('accepts enableCompression as false (not just true)', async () => {
        // This tests hasOwnProperty behavior — false should be valid
        const config = { ...validConfig, enableCompression: false };
        const result = await validateInitConfig(config);
        expect(result.dbIsCompressionEnabled).toBe(false);
    });

    // ─────────────────────────────────────
    // TEST GROUP 5: Backup time validation
    // ─────────────────────────────────────

    test('throws error for backup time without colon', async () => {
        const config = { ...validConfig, backupTime: '0230' };
        
        await expect(validateInitConfig(config))
            .rejects
            .toThrow('Invalid backupTime');
    });

    test('throws error for invalid hours (25:00)', async () => {
        const config = { ...validConfig, backupTime: '25:00' };
        
        await expect(validateInitConfig(config))
            .rejects
            .toThrow('Invalid backupTime');
    });

    test('throws error for invalid minutes (14:61)', async () => {
        const config = { ...validConfig, backupTime: '14:61' };
        
        await expect(validateInitConfig(config))
            .rejects
            .toThrow('Invalid backupTime');
    });

    test('converts valid backup time to Date object', async () => {
        const result = await validateInitConfig(validConfig);
        expect(result.dbBackupTime).toBeInstanceOf(Date);
        expect(result.dbBackupTime.getHours()).toBe(2);
        expect(result.dbBackupTime.getMinutes()).toBe(30);
    });

    // ─────────────────────────────────────
    // TEST GROUP 6: Backup path validation
    // ─────────────────────────────────────

    test('throws error for non-existent backup path', async () => {
        const config = { 
            ...validConfig, 
            backupPath: '/path/that/does/not/exist/xyz' 
        };
        
        await expect(validateInitConfig(config))
            .rejects
            .toThrow('No such directory');
    });

    test('throws error when backup path is a file not directory', async () => {
        // Create a temporary FILE (not folder) for this test
        const testFile = path.join(__dirname, 'test-file.txt');
        fs.writeFileSync(testFile, 'test');
        
        const config = { ...validConfig, backupPath: testFile };
        
        await expect(validateInitConfig(config))
            .rejects
            .toThrow('is a file');
        
        // Clean up the test file
        fs.unlinkSync(testFile);
    });
});