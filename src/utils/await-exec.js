const exec = require('child_process').exec;  //importing exec function from child_process module
// child_process allows node to run OS -level commands
const  Exec = async (command, options = {log: false,cwd :process.cwd()})=>{ //defining a async function named exec 
    if(options.log) console.log(command); //prints the command being executed
    let promise = new Prmoise((resolve, reject)=>{  //creates manual promise as exec() is callback- based,we convert it into promise based 
        exec(command,{...options},(err,stdout, stderr)=>{   //runs command , spreads option object

            if(err){        //if command fails, attach stdout and stderr to error, reject promise
                err.stdout = stdout; //upper layer can access error output
                err.stderr = stderr;
                reject(err);
                return ;
            }
            
            resolve({stdout,stderr});   //if success, returns stdout and stdeerr both
        });
    });

    return await promise;  //retuen resolved promise result

};

module.exports=Exec ;