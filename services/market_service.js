const { createHmac } = require('crypto');
const axios = require('axios');

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
  * @param axiosService str - axios api caller
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
  async checkOpenOrdersValid(orders, theTicker){
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


  /**
  * Place an order
  *
  * @param theTicker str - the ticker pair ie. ETHUSDT
  * @param marketPrice float - price
  * @param rawTicker str - the ticker  ie. ETH
  * @param side str - the side  ie. BUY OR SELL
  * @param fs obj - file system object to enable writing to filesystem
  * @param axiosService str - axios api caller
  *
  * return response obj
  */
  async placeOrder(theTicker, marketPrice, rawTicker, side, fs, axiosService, amountsHeld, initService){
    const timestamp = axiosService.generateTimestamp();
    let timeInForce = process.env.TIME_IN_FORCE_GTC;

    //BUY IS WHEN WE BUY ETH WITH TETHER
    //SELL US WHEN WE SELL TETHER FOR ETH

    //set the amount to buy
    let buyAmount = this.calculateTradeAmount(side, amountsHeld[rawTicker], amountsHeld[process.env.USDT_SYMBOL], marketPrice, initService);

 buyAmount = buyAmount / 20; //testing
 buyAmount = buyAmount.toFixed(initService.precision);//testing
 
console.log(buyAmount + "BUY AMOUNT")
    const dataset = "symbol=" + theTicker + "&side=" + side + "&type=LIMIT&quantity=" + buyAmount + "&timeInForce=" + timeInForce +"&price=" + marketPrice + "&newClientOrderId=my_order_id_1&timestamp=" + timestamp;

    const sign = buildSign(dataset, initService.apiSecret);

    let endpoint = initService.apiRoot + process.env.BINANCE_ENDPOINT_ORDER;
    let endpointSend = endpoint + "?" + dataset + '&signature=' + sign;

    var config = {
      method: 'post',
      url: endpointSend,
      headers: {
        'Content-Type': 'application/json',
        'X-MBX-APIKEY': initService.apiKey
      }
    };

    const results = await Promise.all([

      axios(config)
      .then(function (response) {
        return JSON.stringify(response.data);
      })
      .catch(function (error) {
        console.log(error);
        return false;
      })

    ]);

    return results;
  }

  /**
  * Calculate quantity of currency to trade
  *
  * @param side str - the side  ie. BUY OR SELL
  * @param curAQuantity float - Quantity of crypto
  * @param usdtQuantity float - Quantity of tether
  * @param price float - buy / sell price of currency
  * @param initService obj - obecjt of initialized items
  *
  * return response obj
  */
  calculateTradeAmount(side, curAQuantity, usdtQuantity, price, initService){
    //Buy - we need to calculate how much token we can get for our USDT
    if(side == process.env.BUY){
      //Trade a little bit less than we currently hold to ensure valid transaction
      let amount = 1 / price * usdtQuantity * 1000 / 1001;

      //All binance transactions require a maximum precision level or fail
      amount = amount.toFixed(initService.precision);
      return amount;
      // 1 btc = 100 usdt
      // I can buy 1 / 100 btc * 50usdt
    } else if(side == process.env.SELL){
      let amount = curAQuantity * 1000 / 999 / 1000;
      amount = amount.toFixed(initService.precision);
      return amount;
    }
  }


}

const marketService = new market_service();

module.exports = marketService;
