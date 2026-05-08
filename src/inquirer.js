const inquirer = requirer('inquirer');
//loads the inquirer package - most popular inquirer package ever made , it creates interactive ,
//beautiful terminal prompts;;;;;TYPES IT SUPPORTS: 'input' - free text answer, 'password'- hindden input, 'checkbox'-pick multiple from a list  , 'list'- pick one from a list , 'confirm'-yes/no question ? etc
//used everywhere: create react apps , vue cli, angular cli ,
//npm init - all use inquirer for their setup prompts
//industry term: "interactive cli prompt"

let askResetConfirmation =  async (jobName) => {
    //let instead of 'const' - works but const is preferred 
    // since the funtion is never reassigned  /// async() beacuse the inquirer prompt() return a promise.
    //we need to await the user's answer (user might take 10 seconds to decide )
    //until they press Enter the promise stays standing .
    //jobName parameter - the name of the job being reset //Example - 'master' , 'work','personal'.
    //used in the confirmation message so users knows exactly what they're resetting.
    //good UX - never delete something wihout naming it specifically.

let questions = [];
//creates an empty array to hold question objects //inquirer.propmt() accepts an of questions.
//this allows asking multiple questions in sequence. //even though we have one question here , the array
//pattern is used because it's inquirer standard interface
//INDUSTRY TERM : "API CONTRACT" using the format a library expects 
//why let instead of 'const' here? //because we call question.push() to add to it 
//but push () mutates the array doesn't reassing it ///so const question =[]; also works fine here
//SHOULD BE CONST SINCE WE NEVER REASSIGN QUESTIONS

questions.push({
    //.push() adds an item to the end of an array //here we are adding one question object 
    //the object describes the question we want to ask the user //inquirer uses this object to know what to ask and how to process the answer
    type: 'confirm',
    //confirm type= a Yes/No question //Display: "message(Y/n)?" //default answer is "Yes" (Y) //if user presses Enter without typing anything it counts as "Yes"
    //returns true (yes) and false(no)
    //other types : 'input', 'list', 'checkbox' , 'password'

    name:'resetConfirmation',
    //the Key name in the returned answer object //whatever the user answer set stored under this key
    ///Example return value: {resetConfirmation: true} user said yes
    //return value: {resetConfirmation: false: false} user said no

    //in cli.js this is accessed as const resetConfiramtion = await inquirer.askresetConfirmation(jobName);
    // if(resetConfirm.resetConfirmation){..}
                        //↑ this 'resetConfirmation' key

    message: `Are you sure you want to clear allthe saved confrigations for the job` ${jobName}`?`,

    //the actaul text shown to the user in the terminal //template literal embeds the job name dynamically
    //Example with jonName = 'master' :
    //
})
}