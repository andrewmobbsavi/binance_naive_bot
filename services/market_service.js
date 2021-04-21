const { createHmac } = require('crypto');

//Build signature for api validation
const buildSign = (data, secret) => {
  return createHmac('sha256', secret).update(data).digest('hex');
};

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

  /**
  * Gets the current order book bids and asks with BINANCE_DEPTH number of levels
  *
  * @param curA str - ie ETH
  * @param curB str - ie USDT
  * @param apiSecret str - api secret
  * @param apiKey str - api key
  * @param apiRoot str - api root uri
  * @param axiosService str - api root uri
  *
  * @returns value obj
  */

  async getAmountsHeld(curA, curB, apiSecret, apiKey, apiRoot, axiosService, fs){
    const timestamp = axiosService.generateTimestamp();
    let dataset = "timestamp=" + timestamp;

    const sign = buildSign(dataset, apiSecret);

    //Get the balance of our tokens
    let headersmain = {
      headers: {
        'Content-Type': 'application/json',
        'X-MBX-APIKEY': apiKey
      }
    }

    let endpoint = apiRoot + process.env.BINANCE_ENDPOINT_ACCOUNT + "?" + dataset + "&signature=" + sign;

    let value = await axiosService.getAxios(endpoint, headersmain, fs);

    var vals = {};

    console.log(value[0].data.balances);

    for(let i = 0; i < value[0].data.balances.length; i++){
      if(value[0].data.balances[i].asset === curA){
        vals[curA] = value[0].data.balances[i].free;
      } else if(value[0].data.balances[i].asset === curB){
        vals[curB] = value[0].data.balances[i].free;
      }
    }

    console.log(vals);

    return vals;
  }


  /**
  *Checks pending orders on chain
  *
  * @param apiSecret str - api secret
  * @param apiKey str - api key
  * @param apiRoot str - api root uri
  * @param axiosService str - api root uri
  *
  * return response obj
  *
  */
  async checkOpenOrders(apiSecret, apiKey, apiRoot, axiosService, fs){
    const timestamp = axiosService.generateTimestamp();

    let dataset = "timestamp=" + timestamp;

    const sign = buildSign(dataset, apiSecret);

    // console.log(sign);

    //Get the balance of our tokens
    let headersmain = {
      headers: {
        'Content-Type': 'application/json',
        'X-MBX-APIKEY': apiKey
      }
    }

    let endpoint = apiRoot + process.env.BINANCE_ENDPOINT_OPEN_ORDERS + "?" + dataset + "&signature=" + sign;

    let response = await axiosService.getAxios(endpoint, headersmain, fs);

    return response;
    //BINANCE_ENDPOINT_OPEN_ORDERS
  }



  /**
  *If orders are buy, and buy price is lower than marketprice by ratio, then cancel
  * @param orders arr - arr with order details
  * @param the_ticker str - the ticker pair ie. ETHUSDT
  *
  * return bool
  */
  checkOpenOrdersValid(orders, theTicker){
    //do not process orders if there is already an existing order for the same ticker
    let counter = 0;
    for(let i = 0; i < orders.length; i++){
      if(orders[i].symbol == theTicker){
        counter++;
      }
    }
    if(counter >= 1){
      // console.log("INVALID");
      return false;
    } else {
      return true;
    }
  }



}

const marketService = new market_service();

module.exports = marketService;
