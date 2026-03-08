const {Transform} = require('stream');  //transform is special type of stream that can modify data while it is passing

class AppendInitVect extends Transform{  //class nameed appendinitvect as it extend transform meanifng it can modify streamed data
    constructor (initVect, opts){        //constructor runs when appendintvect() is created
        super(opts);                    //call parent transform constructor this is required when extending a class
        this.initVect = initVect;       //store intialization vector in instanc , this will be prepended into the encrypted file
        this.appended = false;          //boolean flag to ensure only IV is added once
    }


_transform(chunk, encoding, cb){ // _tranform method is mandatory method in transform stream, it runs automatically for every incoming data chunk
    if(!this.appended){ //if IV is not appended yet
        this.push(this.initVect);   //pudh IV into the stream first
        this.appended = true;       //marked as appended so it doesnt repeat
        
    }this.push(chunk);      //  push actual encrypted chunk
        
        cb();   //call signal processing of this chunk is completed!!
    }
}


module.exports= AppendInitVect;

//basically it adds encryption metadata at the begining of encrypted file.
//called custom transform stream 
