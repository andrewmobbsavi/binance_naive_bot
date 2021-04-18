class axios_service{

  setAxios(axios){
    this.axios = axios;
  }


  async getAxios(endpoint, headers, fs){
    //get Prices
    const results = await Promise.all([

      this.axios.get(endpoint, headers).catch(function (error) {
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

  generateTimestamp(){
    //reset the timestamp for new signatures
    const timestamp = Number(new Date());
    return timestamp;
  }

}

const axiosService = new axios_service();

module.exports = axiosService;
