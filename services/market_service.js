class market_service{
  /**
  * Gets the current order book bids and asks with BINANCE_DEPTH number of levels
  *
  * @param the_ticker str - the ticker pair ie. ETHUSDT
  * @param apiRoot str - root api uri
  * @param axiosService obj - service to connect to apis
  * @param fs obj - file system object to enable writing to filesystem
  *
  * @returns value obj
  */
  async getOrderbook(the_ticker, apiRoot, axiosService, fs){
    //Get the balance of our tokens
    let headersmainb = {
      headers: {
        'Content-Type': 'application/json',
      }
    }

    let tradeendpoint = apiRoot + process.env.BINANCE_ENDPOINT_ORDERBOOK_DEPTH + the_ticker + "&limit=" + process.env.BINANCE_DEPTH;

    let value = await axiosService.getAxios(tradeendpoint, headersmainb, fs);

    return value;

  }

}

const marketService = new market_service();

module.exports = marketService;
