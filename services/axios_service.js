const axios = require('axios');

class axios_service{

  /**
  * Submit an axios get request with headers.
  *
  * @param endpoint str - uri to the api endpoint
  * @param headers obj - headers sent to request
  * @param fs obj - file system object to enable writing to filesystem
  *
  * @returns results obj
  */
  async getAxios(endpoint, headers, fs){
    //get Prices
    const results = await Promise.all([

      axios.get(endpoint, headers).catch(function (error) {
        if (error.response) {
          // Request made and server responded
          console.log(error.response.data);
          console.log(error.response.status);
          console.log(error.response.headers);
        } else if (error.request) {
          // The request was made but no response was received
          // console.log(error.request);
        } else {
          // Something happened in setting up the request that triggered an Error
          console.log('Error', error.message);
        }
        fs.appendFileSync('errors.txt', "  Error!");
        throw("AXIOS ERROR");
      })
    ]);

    return results;
  }


  async postAxios(endPoint, payload, headers){
    const results = await Promise.all([

      axios.post(endPoint, payload, headers).catch(function (error) {
        if (error.response) {
          // Request made and server responded
          console.log(error.response.data);
          console.log(error.response.status);
          console.log(error.response.headers);
        } else if (error.request) {
          // The request was made but no response was received
          console.log(error.request);
        } else {
          // Something happened in setting up the request that triggered an Error
          console.log('Error', error.message);
        }
        fs.appendFileSync('errors.txt', "  Error!");
      })
    ]);

    return results;
  }

  /**
  * Submit an axios get request with headers.
  *
  * returns timstamp
  */
  generateTimestamp(){
    //reset the timestamp for new signatures
    const timestamp = Number(new Date());
    return timestamp;
  }

}

const axiosService = new axios_service();

module.exports = axiosService;
