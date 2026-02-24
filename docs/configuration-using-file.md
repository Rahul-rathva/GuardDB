## Configuration Using a JSON File

You can initialize GuardDB by providing a JSON file with your settings:

### MySQL Config Template (`dbConfig.json`)
{
    "databaseType": "MySQL",
    "username": "root",
    "password": "your_password",
    "host": "localhost",
    "port": 3306,
    "databaseName": "my_app_db",
    "backupPath": "/absolute/path/to/backups",
    "enableCompression": true,
    "backupTime": "02:00"
}

**Command:**
$ GuardDB --config=db --file=./dbConfig.json