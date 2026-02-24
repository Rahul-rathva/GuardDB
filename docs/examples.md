## Database Configuration Examples

#### MySQL
To start the configuration for a MySQL database, run:
$ GuardDB --config db

? Choose the type of database to backup: MySQL
? Enter your database username: root
? Enter your database password: ***
? Enter the database hostname: localhost
? Enter the database server port: 3306
? Enter the database name to backup: my_app_db
? Enter the absolute path for local backups: /home/rahul/backups/
? Do you want backup compression? Yes
? Enter the time to run backups every day: 02:00
✔ Authentication success
Database configuration updated successfully.