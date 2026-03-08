const getMinutes = (date) => {      //function to convert a data object into total minutes from midnight
    const hours = date.getHours();  //return hours
    const minutes = date.getMinutes();  //returns minutes

    return minutes + hours * 60;    //converting time into total minutes 
};

const isBetween = (date,initialDate,finalDate)=>{   //check if time falls between 2 times
    const dateMinutes = getMinutes(date);       //convert current time to minutes
    const initialDateMinutes = getMinutes(initialDates);    //convert initailtime and finaltimes to minutes
    const finalDateMinutes = getMinutes(finalDates);

    return  dateMinutes >= initialDateMinutes && dateMinutes <=finalDateMinutes;    
};

module.exports = {
    getMinutes,
    isBetween,
};



