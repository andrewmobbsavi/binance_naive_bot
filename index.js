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
//PLACE A SIMPLE ORDER
if(initService.type == "SIMPLESELL"){
  simpleSell();
}



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

  //before we proceed we need to get the amount of tether in our account and pass instead of 40,000
  let amountsHeld = await marketService.getAmountsHeld(initService.main_ticker, process.env.USDT_SYMBOL, initService.apiSecret,  initService.apiKey, initService.apiRoot, axiosService, fs);

  //get Buy price and volume
  const buyOrders = parserService.calculateBuyPriceAndAmount(orderbook[0].data.asks, amountsHeld[process.env.USDT_SYMBOL], initService.precision);

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

/*
symbol – we’ve come across this one previously. This is the pair you want to trade.
side – here, you’ll stipulate whether you want to BUY or SELL. With the BTCUSDT pair,
 indicates that you want to buy BTC for USDT, whereas sell will sell BTC for USDT.
type – the type of order you want to submit. Possible values
*/


  //Gets the current open orders.
  const openOrders = await marketService.checkOpenOrders(initService.apiSecret, initService.apiKey, initService.apiRoot, axiosService, fs);

  //Checks if there are open orders on the account for the currency pair in question
  let ordersValid = await marketService.checkOpenOrdersValid(openOrders[0].data, initService.compare_ticker);

  console.log("PRE");
  //Only continue if there are no pending orders for the token pair
  if(ordersValid){
    //If holding, don't care about the priceTracker, only care about buyTracker
    if(holding){
      console.log("Holding Entering Sell");
      //Create the sell order GTC based on buy price
      let amountsHeld = await marketService.getAmountsHeld(initService.main_ticker, process.env.USDT_SYMBOL, initService.apiSecret,  initService.apiKey, initService.apiRoot, axiosService,fs);

      //Set price to sell at
      let sellPrice = buyTracker * ( 1 + sellPercentage);
      sellPrice = sellPrice.toFixed(2);

      //Timestamp for signature
      let timestampSell = axiosService.generateTimestamp();

      const sellStatus = await marketService.placeOrder(initService.compare_ticker, sellPrice, initService.main_ticker, process.env.SELL, fs, axiosService, amountsHeld, initService);
      //SELL
      if(sellStatus[0]){

        console.log("Create sell Order!!" + sellPrice + " vs BuyPrice of " + buyTracker);

        let msgString = `${dateShow} CREATE SELL ORDER ${initService.main_ticker} @: $${sellPrice}.\r\n`;
        console.log(msgString);
        fs.appendFileSync('trades.txt', msgString);

        buyTracker = null;
        holding = false;

        priceTracker = sellPrice;

      }
    } else {
      //Not holding BUY BUY BUY BUY BUY BUY BUY BUY BUY BUY BUY BUY BUY BUY BUY BUY BUY BUY
      //Get the difference
      //The diff will be negative if price has risen, positive if price has fallen
      /*
        Here we care about priceTracker
      */
      let priceDiff = priceTracker - marketPrice;

      let decrease = (priceDiff > 0);
      // let decrease = (priceDiff >= 0);//test

      let priceDiffRatio = Math.abs(priceDiff / priceTracker);

      //test
      // let testbuyPercentage = 0;

      //Different criteria for profit vs loss
      //BUY
      if(decrease && (priceDiffRatio >= buyPercentage)){
      // if(decrease && (priceDiffRatio >= testbuyPercentage)){ //test

        //Set the buy order and get the buy status
        //get amounts held
        let amountsHeld = await marketService.getAmountsHeld(initService.main_ticker, process.env.USDT_SYMBOL, initService.apiSecret,  initService.apiKey, initService.apiRoot, axiosService,fs);

        //successful buy must be at ask price or higher
        let timestampBuy = axiosService.generateTimestamp();

        let buyStatus = await marketService.placeOrder(initService.compare_ticker, marketPrice, initService.main_ticker, process.env.BUY, fs, axiosService, amountsHeld, initService);

        //Only set as bought if bought - otherwise continue checking the order
        if(buyStatus[0]){
          console.log("BOUGHT!!!");
          // console.log(buyStatus + " STATUS");
          let msgString = `${dateShow} BUY ${initService.main_ticker} @: $${marketPrice}\r\n`;

          fs.appendFileSync('trades.txt', msgString);

          buyTracker = marketPrice
          priceTracker = marketPrice;
          holding = true;

          console.log(msgString);
        } else {
          console.log("Buy not successful");
        }
      }

      //Set pricetracker logic
      /*
        if previous vs current market higher than 1% increase, then reset
        we use price tracker to track previous non-action prices
      */
      if(!decrease && (priceDiffRatio > buyPercentage)){
        priceTracker = marketPrice;
      }

      console.log(priceTracker + " PRICE TRACKER");
    }//end holding

  } else {//end orders valid

    console.log("OPEN ORDERS CURRENTLY EXIST. NO ACTION TAKEN.");
  }


  console.log(`
    Current: ${initService.compare_ticker} $${marketPrice}... Pricetracker: $${priceTracker}
  `);

  //Add records
  let msgString = `${dateShow} ${initService.compare_ticker}: $${marketPrice}s\r\n`;
  fs.appendFileSync('history.txt', msgString);


};



async function simpleSell(){

  console.log("SIMPLE SELL!");

  let amountsHeldb = await marketService.getAmountsHeld(initService.main_ticker, process.env.USDT_SYMBOL, initService.apiSecret,  initService.apiKey, initService.apiRoot, axiosService, fs);


  let timestampBuy = axiosService.generateTimestamp();

  let amountsHeld = {};

  amountsHeld[initService.main_ticker] = initService.vol;
  amountsHeld[process.env.USDT_SYMBOL] = 0;

  let buyStatus = await marketService.placeOrder(initService.compare_ticker, initService.price, initService.main_ticker, process.env.SELL, fs, axiosService, amountsHeld, initService);

  throw "SIMPLE ORDER COMPLETED";
}


//Run the bot every x milliseconds. Will buy when price goes below buyPercentage, sell above sellPercentage
const run = () => {
  const config = {
    buyPercentage: 0.01, //%fall to buy
    sellPercentage: 0.006, //% rise to sell
    tickInterval: 5000
  };
  setInterval(tick, config.tickInterval, config);

};

run();
