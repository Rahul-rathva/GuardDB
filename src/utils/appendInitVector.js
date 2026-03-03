const {transform} = require('stream'); //imports tansform stream line cause need custom stream behaviour
class AppendInitVect extends Transform{ // creates custom transform stream
                                        // tansform streams : modify data passing through
    
    contructor(initVect,opts){          //recieves iv + encryption tag and stream options
        super(opts);                    //store iv to use later
        this.initVect = initVect;       
        this.append = false;            
    }

    _transform(chunk, encoding, cb){  //runs for every chunk of data passing through stream
        if(!this.appended){            //check if IV already inserted 
            this.push(this.InitVect);   // add IV tag at the begining of the encrypted file
            this.appended = true;
        }
        this.push(chunk);           //then push actual encrypted data.
        cb();                       //tell stream:processing finished for this chunk
    }
} 

module.exports = AppendInitVect;

//without this file : IV wont be saved , Decryption impossible, encryptoed files Useless
//file ensures: encrypted file contains [EncryptionTag][IV][EncryptedData]
// significance : this is called advanced stream manipulation 
//these shows: Understanding of Node Streams, Custom data transformation , real-world encrypyion workflow