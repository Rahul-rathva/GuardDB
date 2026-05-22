const strings = require('./../utils/strings');
//goes up one level (..) then into utils/strings //used for :strings.debugMOdedesc (shown when isdebug is false)
//the .. means that go to parents folder first //path : database/../utils/strings = utils/strings

const configstore = require('conf');
//encrpted config storage - -same as everwhere else // used here to :Read job config in dump() and setupRestore()
//and write upadted config after successful setup in setupConfig()

const mongoDb = require('./mongoDb/mongoDb');
//loads the mongoDb speacialist module // has funstions like connect,dump and restore 
//this file delegates all the work to this module.

const mysqlDb = require('./mysql/mysql');
//loads the mysql specialist module // same interface: connect (),dump(), restore().
//Notice: same function name as mongodb- consistent API design
//industry term: "consistent interface"/"polymorphism" //All the three database module speaks the same language

const postgresql = require('./posgresql/postgresql');
//same interface again .connect , dump and restore 

const inquirer = require('./inquirer');
//this is the database folder's OWN inquirer.js  //not the top level inquirer.js(which only had askresetconfirmation)
//this one has database specofic questions : askconfig() - "which database type"?host?port? username ?password?
//askRestoreConfig() - "which backup files to restore from?"  //Path : ./inquirer = database/inquirer.js

const ora = require('ora');
//terminal spinner for long running operations // used twice :"Authencating you, please wait. "during the db connection test 
//2. "restoring, please wait, ..." during backup restore  //shows the user that the system is workong fine and not frozen

const validator = require('./validator');
//validates config when loaded from a file(--file flag)  // when a user provides a json config file instead of answering prompts
//validator.validateinitconfig() checks the  file has correct structure. // if config  file has wrong keys or missing values  -> throws an error early 
//industry term : "input validation "/"Schema validation"

const setupConfig = async (jobName,key,isdebug,filepath = undefined) => {
    
}