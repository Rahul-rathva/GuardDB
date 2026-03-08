const fs = require ('fs');  // built in file module system to read files from disk
const strings = require('./strings');   //Imports Encryption file from this file and contains the custom identifier added during encryption 

let readData = async (fileName) => {    //declares async function and accepts file, why async? file reading is async in nodejs
    const chunks = [];      // empty array for storing file chunks  as file streams sends data in chunks or pieces.
    const readStream = fs.createReadStream(fileName,{start: 0,end: 3}); //reading only first 4 bytes as EncryptionTag is 4 character long 
    // instead of reading entire file we only need first 4 bytes as faster and memory efficient.
    let promise = new Promise ((resolve,reject)=>{
        // creates manual promise as streams are event based.

    readStream.on('error',()=>{     // if not then error occured and promises rejected 
        reject();
    });
    readStream.on('data',(chunk)=>{    // push chunks into array as somtimes stream may send multiple small chunks
        chunks.push(chunk);
    });
    readStream.on('end',()=>{       //when reading finishes it combines all chunks and convert buffer to string and resolve promise with string
        resolve(Buffer.concat(chunks).toString('utf-8'));
    });
    });
    return promise; //return 4 bytes as strings
};

let isEncrypted = async (fileName) => {  //async function
    let data = await readData(fileName);    // reads first 4 bytes of the file
    if(data === strings.encryptionTag){     //Compares first 4 bytes with Encryption tag
        return true;                        //if equal = file is encrypted 
    }else{
        return false;                       //else not encrypted
    }
};

module.exports ={           //exports funstion so other files cacn use it
    isEncrypted,
};


//without this same file encrypt twice leading to double encryption. Decryption would fail and file becomes corrupted