require('dotenv').config();

/*
  BUY AND SELL VERIFICATIONS. IF NO VERIFICATION, THEN FAIL.
  ALSO, VERIFICATION OF PRICE
*/

const { createHmac,} = require('crypto');
const axios = require('axios');
const axiosService = require('./services/axios_service');
axiosService.setAxios(axios);
//store data
const fs = require('fs');

const marketService = require('./services/market_service');

const initService = require('./services/init_service');


/*
  1. Get balance
  2. Get price
  3. Calculate buy amount ie. price * tether
*/

//See https://github.com/binance-exchange/binance-signature-examples

//****************************************************************************************//

//globals for generating signatures in api calls

const buildSign = (data, secret) => {
  return createHmac('sha256', secret).update(data).digest('hex');
};


//Amount of money
var stack = 1000;


//tracks the price we are currently on
var priceTracker = null;
var holding = false;
var buyTracker = null; //track currently held values
var tradePrice = null;

//Run in setinterval
const tick = async(config) => {


  // await getAmountsHeld(process.env.BNB_SYMBOL, process.env.USDT_SYMBOL, initService.apiSecret,  initService.apiKey, initService.apiRoot, axiosService, "BUY");


  console.log(holding + " HOLDING");
  //Get order data from binance
  let orderbook = await getBuyOrderbook(initService.compare_ticker, initService.apiRoot, axiosService);
  console.log(orderbook[0].data);

  //timestamp for signature
  const timestamp = axiosService.generateTimestamp();
  var dateShow = new Date(timestamp);

  const { buyPercentage, sellPercentage } = config;
console.log(buyPercentage);
console.log(sellPercentage);
  //Get the market price - here we use bid or ask, depending on hold status;
  //Really should be called order book price
  const orderbookPrice = setMarketPrice(holding, orderbook[0].data);

  const marketPrice = await getPrice(initService.compare_ticker, initService.apiRoot);

  if (!priceTracker){
    priceTracker = marketPrice;
  }


/*
symbol – we’ve come across this one previously. This is the pair you want to trade.
side – here, you’ll stipulate whether you want to BUY or SELL. With the BTCUSDT pair,
 indicates that you want to buy BTC for USDT, whereas sell will sell BTC for USDT.
type – the type of order you want to submit. Possible values
*/


  //Check the open orders. If there is a buy order, and the marketprice is out by X margin, cancel the open order
  //if there is a sell order then leave the order as is
  const openOrders = await checkOpenOrders(initService.apiSecret, initService.apiKey, initService.apiRoot, axiosService);


  //Cancels open buy orders beyond a certain price
  let ordersValid = checkOpenOrdersValid(openOrders[0].data, initService.compare_ticker);
console.log("Order Validity: " + ordersValid);
  //Only continue if there are no pending orders for the token pair
  if(ordersValid){
    //If holding, don't care about the priceTracker, only care about buyTracker
    if(holding){
      //Get the difference
      //The diff will be negative if price has risen, positive if price has fallen
      let priceDiff = buyTracker - marketPrice;

      let increase = false;
      // if(priceDiff < 0){ //live
      if(priceDiff <= 0){ //test
        increase = true;
      }

      let priceDiffRatio = Math.abs(priceDiff / buyTracker);

      //Different criteria for profit vs loss
      //SELL
      if(increase && (priceDiffRatio >= sellPercentage)){
        const sellStatus = await placeOrder(initService.compare_ticker, marketPrice, initService.main_ticker, process.env.SELL, orderbookPrice);
console.log("SELLLLLLLLLLLLLLLLLLLLLLLLLL");
console.log(sellStatus);
console.log("SELLLLLLLLLLLLLLLLLLLLLLLLLL");
        if(sellStatus[0]){
          //Total remaining in stack
          let profit = stack * priceDiffRatio;

          stack = stack + profit;

          console.log("SELL! " + profit);

          let msgString = `${dateShow} SELL ${initService.main_ticker} @: $${tradePrice}. Profit $${profit}. Stack $${stack}\r\n`;
          console.log(msgString);
          fs.appendFileSync('trades.txt', msgString);

          buyTracker = null;
          holding = false;

          priceTracker = tradePrice;
        }

      }
    } else {
      //Not holding BUY BUY BUY BUY BUY BUY BUY BUY BUY BUY BUY BUY BUY BUY BUY BUY BUY BUY
      //Get the difference
      //The diff will be negative if price has risen, positive if price has fallen
      /*
        Here we care about priceTracker
      */
      let priceDiff = priceTracker - marketPrice;
      let decrease = false;

      // if(priceDiff > 0){  //live
      if(priceDiff >= 0){ //test
        decrease = true;
      }

      let priceDiffRatio = Math.abs(priceDiff / priceTracker);

      //Different criteria for profit vs loss
      //BUY
      if(decrease && (priceDiffRatio >= buyPercentage)){

        //Set the buy order and get the buy status
        // console.log(initService.compare_ticker);

        //successful buy must be at ask price or higher
        let buyStatus = await placeOrder(initService.compare_ticker, marketPrice, initService.main_ticker, process.env.BUY, orderbookPrice);

        //Only set as bought if bought - otherwise continue checking the order
        if(buyStatus[0]){
          console.log("BUYING!!!");
          // console.log(buyStatus + " STATUS");
          let msgString = `${dateShow} BUY ${initService.main_ticker} @: $${tradePrice}\r\n`;

          fs.appendFileSync('trades.txt', msgString);

          buyTracker = tradePrice
          priceTracker = tradePrice;
          holding = true;

          console.log(msgString);
        } else {
          console.log("Buy not successful");
        }
      }

      //Set pricetracker logic
      /*
        if previous vs current market higher than 1% increase, then reset
      */
      if(!decrease && priceDiffRatio > buyPercentage){
        priceTracker = marketPrice;
      }
    }//end holding

  }//end orders valid


  console.log(`
    Current: ${initService.compare_ticker} $${marketPrice}... Pricetracker: $${priceTracker}
  `);

  //Add records
  let msgString = `${dateShow} ${initService.compare_ticker}: $${marketPrice}s\r\n`;
  fs.appendFileSync('history.txt', msgString);


};


const run = () => {
  const config = {
    buyPercentage: process.env.BUY_PERCENTAGE, //%fall to buy
    sellPercentage: process.env.SELL_PERCENTAGE, //% rise to sell
    tickInterval: 3000
  };


  setInterval(tick, config.tickInterval, config);

};

run();


function checkStatus(buyObj){


}

async function setSell(priceDiffRatio, marketPrice){
  //Total remaining in stack
  let profit = stack * priceDiffRatio;

  stack = stack + profit;

  console.log("SELL! " + profit);

  let msgString = `${dateShow} SELL ${initService.compare_ticker} @: $${marketPrice}. Profit $${profit}. Stack $${stack}\r\n`;

  fs.appendFileSync('trades.txt', msgString);

  buyTracker = null;
  holding = false;

  priceTracker = marketPrice;
  //https://api.binance.com/api/v3/ticker/price?symbol=ETHUSDT
}

async function getPrice(the_ticker, apiRoot){
  //Get the balance of our tokens
  let headersmainb = {
    headers: {
      'Content-Type': 'application/json',
    }
  }

  let tradeendpoint = apiRoot + process.env.BINANCE_ENDPOINT_PRICE + the_ticker;
  let value = await axiosService.getAxios(tradeendpoint, headersmainb, fs);
  return value[0].data.price;

}

//Gets the latest bid and ask for a ticker pair
async function getBuyOrderbook(the_ticker, apiRoot, axiosService){
  //Get the balance of our tokens
  let headersmainb = {
    headers: {
      'Content-Type': 'application/json',
    }
  }

  let tradeendpoint = apiRoot + process.env.BINANCE_ENDPOINT_ORDERBOOK + the_ticker;
  let value = await axiosService.getAxios(tradeendpoint, headersmainb, fs);
  return value;

}





async function placeOrder(theTicker, marketPrice, rawTicker, side, orderbookPrice){

  const offsetRatio = 0.01;
  let timeInForce = "GTC";

  if(side == process.env.BUY){
    // timeInForce = "FOK";
  }

  //BUY IS WHEN WE BUY ETH WITH TETHER
  //SELL US WHEN WE SELL TETHER FOR ETH

  const timestamp = axiosService.generateTimestamp();

  tradePrice = setTradePrice(side, orderbookPrice, marketPrice, offsetRatio);


  //get amounts held
  let amountsHeld = await getAmountsHeld(rawTicker, process.env.USDT_SYMBOL, initService.apiSecret,  initService.apiKey, initService.apiRoot, axiosService, side);

  //set the amount to buy
  let buyAmount = calculateTradeAmount(side, amountsHeld[rawTicker], amountsHeld[process.env.USDT_SYMBOL], tradePrice);

// console.log(buyAmount);
  if(side == process.env.BUY){
    buyAmount = buyAmount / 50; //testing
    buyAmount = buyAmount.toFixed(initService.precision);
  }

// console.log(tradePrice);
  datasetc = "symbol=" + theTicker + "&side=" + side + "&type=LIMIT&quantity=" + buyAmount + "&timeInForce=" + timeInForce +"&price=" + tradePrice + "&newClientOrderId=my_order_id_1&timestamp=" + timestamp;


  const signb = buildSign(datasetc, initService.apiSecret);

  // let endpointb = apiRoot + process.env.BINANCE_ENDPOINT_ORDER + "?" + datasetc + "&signature=" + signb;
  let endpointb = initService.apiRoot + process.env.BINANCE_ENDPOINT_ORDER;
  let endpointSend = endpointb + "?" + datasetc + '&signature=' + signb;
// console.log(endpointSend);
  // console.log(datasetc);

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
      // console.log(error);
      return false;
    })

  ]);

  return results;
}


async function cancelOrder(theTicker, orderNumber){
  const timestamp = axiosService.generateTimestamp();

  dataset = "symbol=" + theTicker + "&orderId=" + orderNumber + "&timestamp=" + timestamp;

  const sign = buildSign(dataset, initService.apiSecret);

  let endpointb = initService.apiRoot + process.env.BINANCE_ENDPOINT_ORDER;
  let endpointSend = endpointb + "?" + dataset + '&signature=' + sign;

  // console.log(datasetc);

  var config = {
    method: 'delete',
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
      return false;
    })

  ]);

  return results;
}




async function getAmountsHeld(curA, curB, apiSecret, apiKey, apiRoot, axiosService, side){
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
  return vals;
}

//Checks pending orders on chain
async function checkOpenOrders(apiSecret, apiKey, apiRoot, axiosService){
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

function setOrderbookPrice(holding, orderbook){
  let marketPrice = null;
  //sell
  if(holding){
      marketPrice = orderbook[0].data.bidPrice;
  } else {
    //Buy
      marketPrice = orderbook[0].data.askPrice;
  }
  return marketPrice;

}

//If orders are buy, and buy price is lower than marketprice by ratio, then cancel
function checkOpenOrdersValid(orders, theTicker){
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


function setMarketPrice(holding, orderbookData){
  let marketPrice = orderbookData.askPrice;
  //selling
  if(holding){
    marketPrice = orderbookData.bidPrice;
  }

  return marketPrice;
}


function setTradePrice(side, bookPrice, marketPrice, ratio){
  if(side == process.env.SELL){
    if(bookPrice > (marketPrice - (marketPrice * ratio))){
      bookPrice -= 10; //test
      return bookPrice;
    }
  } else if(side == process.env.BUY){
    if(bookPrice < (marketPrice + (marketPrice * ratio))){
      bookPrice += 10;
      return bookPrice;
    }
  }

  return marketPrice;
}

function calculateTradeAmount(side, curAQuantity, usdtQuantity, price){


  //Buy - we need to calculate how much token we can get for our USDT
  if(side == process.env.BUY){
    // let amount = Math.floor( 1 / price * usdtQuantity * 1000 / 999 / 1000);
    let amount = 1 / price * usdtQuantity * 1000 / 998;
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
