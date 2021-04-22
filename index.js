require('dotenv').config();

const { createHmac,} = require('crypto');

const axiosService = require('./services/axios_service');
//store data
const fs = require('fs');

const marketService = require('./services/market_service');
const parserService = require('./services/parser_service');
const initService = require('./services/init_service');



//See https://github.com/binance-exchange/binance-signature-examples

//****************************************************************************************//



//Amount of money
var stack = 1000;


//tracks the price we are currently on
var priceTracker = null;
var holding = false;
var buyTracker = null; //track currently held values
var tradePrice = null;

//Run in setinterval
const tick = async(config) => {


  console.log(holding + " HOLDING");
  //Get order data from binance - will not continue unless successful
  let orderbook = await marketService.getOrderbook(initService.compare_ticker, initService.apiRoot, axiosService, fs);

  //before next we need to get the amount of tether in our account and pass instead of 40,000
  //get Buy price and volume
  const buyOrders = parserService.calculateBuyPriceAndAmount(orderbook[0].data.asks, 40000, initService.precision);

  console.log(buyOrders);

  // throw("buyOrders");
  //get latest buy price

  /*
    1. Calculate current holdings relative to currency
        ie. if we are in buy state, calculate
          a) Tether / average price = eth desired
          b) Loop through asks and sum the volumes until we reach eth desired
          c) Record that price
          d) Set the market buy price as that price


        After buy state, set sell price at 0.X % above buy price
  */



  //timestamp for signature
  const timestamp = axiosService.generateTimestamp();
  var dateShow = new Date(timestamp);

  const { buyPercentage, sellPercentage } = config;

  //Get the market price - here we use bid or ask, depending on hold status;
  //Really should be called order book price
  const orderbookPrice = buyOrders[0];
  const marketPrice = orderbookPrice;

  if (!priceTracker){
    priceTracker = marketPrice;
  }

  let amountsHeld = await marketService.getAmountsHeld(initService.main_ticker, process.env.USDT_SYMBOL, initService.apiSecret,  initService.apiKey, initService.apiRoot, axiosService, "BUY", fs);
/*
symbol – we’ve come across this one previously. This is the pair you want to trade.
side – here, you’ll stipulate whether you want to BUY or SELL. With the BTCUSDT pair,
 indicates that you want to buy BTC for USDT, whereas sell will sell BTC for USDT.
type – the type of order you want to submit. Possible values
*/


  //Check the open orders.
  const openOrders = await marketService.checkOpenOrders(initService.apiSecret, initService.apiKey, initService.apiRoot, axiosService, fs);

  //Cancels open buy orders beyond a certain price
  let ordersValid = marketService.checkOpenOrdersValid(openOrders[0].data, initService.compare_ticker);


  //Only continue if there are no pending orders for the token pair
  if(ordersValid){
    //If holding, don't care about the priceTracker, only care about buyTracker
    if(holding){
      //Get the difference
      //The diff will be negative if price has risen, positive if price has fallen
      let priceDiff = buyTracker - marketPrice;

      let increase = false;
      if(priceDiff < 0){ //live
      // if(priceDiff <= 0){ //test
        increase = true;
      }

      let priceDiffRatio = Math.abs(priceDiff / buyTracker);

      //Different criteria for profit vs loss
      //SELL
      if(increase && (priceDiffRatio >= sellPercentage)){
        const sellStatus = await placeOrder(initService.compare_ticker, marketPrice, initService.main_ticker, process.env.SELL, orderbookPrice, fs);
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

      let priceDiffRatio = Math.abs(priceDiff / priceTracker);

      //test
      let testbuyPercentage = 0

      //Different criteria for profit vs loss
      //BUY
      // if((priceDiff > 0) && (priceDiffRatio >= buyPercentage)){
      if((priceDiff >= 0) && (priceDiffRatio >= testbuyPercentage)){ //test

        //Set the buy order and get the buy status
        //get amounts held
        let amountsHeld = await marketService.getAmountsHeld(initService.main_ticker, process.env.USDT_SYMBOL, initService.apiSecret,  initService.apiKey, initService.apiRoot, axiosService, process.env.BUY, fs);

        //successful buy must be at ask price or higher
        let timestampBuy = axiosService.generateTimestamp();

        let buyStatus = await marketService.placeOrder(initService.compare_ticker, marketPrice, initService.main_ticker, process.env.BUY, fs, axiosService, amountsHeld, initService);

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
