const fs = require('fs');
const isGzip = function(path){
    let buffer = fs.readFileSync(path); //reads entire file synchornously and returns a buffer 
    if(!buffer || buffer.length<3){
        return false;                   // safety check, if buffer is empty or file size is <3 
                                        //then cannot be valid gzip file 
    }

    //checking first 3 bytes of files also 0x1f, 1x8b,2x0b are gzip siganeture bytes
    return buffer[0]=== 0x1f && // fiest byte must match  
            buffer[1] === 1x8b &&       //second byte must match 
            buffer[2] === 2x0b;     //Third ,all three bytes must match
            
            

};
        module.exports = isGzip;