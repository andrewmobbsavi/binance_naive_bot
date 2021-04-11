require('dotenv').config();

/*

  BUY AND SELL VERIFICATIONS. IF NO VERIFICATION, THEN FAIL.
  ALSO, VERIFICATION OF PRICE

*/

const {
  createHmac,
} = require('crypto');


const axios = require('axios');

//store data
const fs = require('fs');

//QuoteOrderQty

//Arguments as env, ticker

const argsGet = process.argv;

const appEnv = argsGet[2];
const currency = argsGet[3];

//Local settings
var apiKey = process.env.TEST_BINANCE_API_KEY;
var apiSecret = process.env.TEST_BINANCE_SECRET_KEY;
var apiRoot = process.env.TEST_BINANCE_API_ROOT;

if(appEnv == process.env.LIVE_ENVIRONMENT){
  apiKey = process.env.BINANCE_API_KEY;
  apiSecret = process.env.BINANCE_SECRET_KEY;
  apiRoot = process.env.LIVE_BINANCE_API_ROOT;
}



/*
  1. Get balance
  2. Get price
  3. Calculate buy amount ie. price * tether
*/

//See https://github.com/binance-exchange/binance-signature-examples

//****************************************************************************************//

//globals for generating signatures in api calls
var timestamp = Number(new Date());

const buildSign = (data, secret) => {
  return createHmac('sha256', secret).update(data).digest('hex');
};


//TESTING
// var results = [];
// results[0] = {data:{bitcoin:{usd:60000}}}
// let increaser = false;
// var intervalCount = 0;
//END TESTING

//Amount of money
var stack = 1000;



//tracks the price we are currently on
var priceTracker = null;
var holding = false;
var buyTracker = null; //track currently held values


var compare_ticker = process.env.BNB_USDT;
var main_ticker = process.env.BNB_SYMBOL;

if(currency == process.env.BTC_SYMBOL){
  compare_ticker = process.env.BTC_USDT;
  main_ticker = process.env.BTC_SYMBOL;
} else if(currency == process.env.ETH_SYMBOL){
  compare_ticker = process.env.ETH_USDT;
  main_ticker = process.env.ETH_SYMBOL;
}

var getAccountEndpoint = apiRoot + process.env.BINANCE_ENDPOINT_ACCOUNT;




//Run in setinterval
const tick = async(config) => {

//TESTING
  // if(results[0].data.bitcoin.usd >= 62000){
  //   results[0].data.bitcoin.usd -= 100;
  //   increaser = false;
  // } else if(results[0].data.bitcoin.usd <= 58000){
  //   results[0].data.bitcoin.usd += 100;
  //   increaser = true;
  // } else {
  //   if(increaser){
  //     results[0].data.bitcoin.usd += 100;
  //   } else {
  //     results[0].data.bitcoin.usd -= 100;
  //   }
  // }

  //END TESTING

  //set default

  var dateShow = new Date(timestamp);

  const { buyPercentage, sellPercentage } = config;

  //Get the market price
  let results = await getPrice(compare_ticker); //get the marketprice
  const marketPrice = results[0].data.price;  //results

  if (!priceTracker){
    priceTracker = marketPrice;
  }


/*
symbol – we’ve come across this one previously. This is the pair you want to trade.
side – here, you’ll stipulate whether you want to BUY or SELL. With the BTCUSDT pair,
 indicates that you want to buy BTC for USDT, whereas sell will sell BTC for USDT.
type – the type of order you want to submit. Possible values
*/


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

      placeOrder(compare_ticker, marketPrice, main_ticker, process.env.SELL);

//Total remaining in stack
      let profit = stack * priceDiffRatio;

      stack = stack + profit;

      console.log("SELL! " + profit);

      let msgString = `${dateShow} SELL ${main_ticker} @: $${marketPrice}. Profit $${profit}. Stack $${stack}\r\n`;

      fs.appendFileSync('trades.txt', msgString);

      buyTracker = null;
      holding = false;

      priceTracker = marketPrice;

    }
  } else {
    //Not holding BUY
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

      placeOrder(compare_ticker, marketPrice, main_ticker, process.env.BUY);

      let msgString = `${dateShow} BUY ${main_ticker} @: $${marketPrice}\r\n`;

      fs.appendFileSync('trades.txt', msgString);

      buyTracker = marketPrice
      priceTracker = marketPrice;
      holding = true;

      console.log(msgString);
    }

    //Set pricetracker logic
    /*
      if previous vs current market higher than 1% increase, then reset
    */
    if(!decrease && priceDiffRatio > buyPercentage){
      priceTracker = marketPrice;
    }
  }


  console.log(`
    Current: ${compare_ticker} $${marketPrice}... Pricetracker: $${priceTracker}
  `);

  //Add records
  let msgString = `${dateShow} ${compare_ticker}: $${marketPrice}\r\n`;
  fs.appendFileSync('history.txt', msgString);


};


const run = () => {
  const config = {
    buyPercentage: 0.0, //%fall to buy
    sellPercentage: 0.0, //% rise to buy
    tickInterval: 1000
  };


  setInterval(tick, config.tickInterval, config);

};

run();


async function getAxios(endpoint, headers){
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
    })
  ]);

  return results;
}


async function postAxios(endPoint, payload, headers){
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


async function setSell(priceDiffRatio, marketPrice){
  //Total remaining in stack
  let profit = stack * priceDiffRatio;


  stack = stack + profit;

  console.log("SELL! " + profit);

  let msgString = `${dateShow} SELL ${compare_ticker} @: $${marketPrice}. Profit $${profit}. Stack $${stack}\r\n`;

  fs.appendFileSync('trades.txt', msgString);

  buyTracker = null;
  holding = false;

  priceTracker = marketPrice;
  //https://api.binance.com/api/v3/ticker/price?symbol=ETHUSDT
}

async function getPrice(the_ticker){
  //Get the balance of our tokens
  let headersmainb = {
    headers: {
      'Content-Type': 'application/json',
    }
  }

  let tradeendpoint = apiRoot + process.env.BINANCE_ENDPOINT_PRICE + the_ticker;
  let value = await getAxios(tradeendpoint, headersmainb);
  return value;

}




function setPrice(side, marketPrice){

  //Rounding precision dp
  let precision = 100;

  //offset to allow for room when spot trading
  let offset = 0.0005;

  if(side == process.env.BUY){
    //ceiling to buy. Floor to sell.
    marketPrice = marketPrice * (1 + offset);
    marketPrice = Math.ceil(marketPrice * precision) / precision;
  } else {
    marketPrice = marketPrice - (marketPrice * offset);
    marketPrice = Math.floor(marketPrice * precision) / precision;
  }

  return marketPrice;
}

async function placeOrder(theTicker, marketPrice, rawTicker, side){
  //BUY IS WHEN WE BUY ETH WITH TETHER
  //SELL US WHEN WE SELL TETHER FOR ETH

  // let results = await getPrice(theTicker); //remove
  //
  // marketPrice = results[0].data.price;  //results remove

  marketPrice = setPrice(side, marketPrice);

  //get amounts held
  let amountsHeld = await getAmountsHeld(rawTicker, process.env.USDT_SYMBOL);

  let buyAmountb = Math.floor(amountsHeld['BNB'] * 100 * 0.999) / 100;

  buyAmount = 0.22;

  datasetc = "symbol="+theTicker+"&side="+side+"&type=LIMIT&quantity="+buyAmount+"&timeInForce=FOK&price="+marketPrice+"&newClientOrderId=my_order_id_1&timestamp="+timestamp;

  const signb = buildSign(datasetc, apiSecret);

  // let endpointb = apiRoot + process.env.BINANCE_ENDPOINT_ORDER + "?" + datasetc + "&signature=" + signb;
  let endpointb = apiRoot + process.env.BINANCE_ENDPOINT_ORDER;
  let endpointSend = endpointb + "?" + datasetc + '&signature=' + signb;

  console.log(datasetc);

  var config = {
    method: 'post',
    url: endpointSend,
    headers: {
      'Content-Type': 'application/json',
      'X-MBX-APIKEY': apiKey
    }
  };

  axios(config)
  .then(function (response) {
    console.log(JSON.stringify(response.data));
  })
  .catch(function (error) {
    console.log(error);
  });
}




async function getAmountsHeld(curA, curB){

  let dataset = "timestamp=" + timestamp;
  // apiSecret="NhqPtmdSJYdKjVHjA7PZj4Mge3R5YNiP1e3UZjInClVN65XAbvqqM6A7H5fATj0j";
  // dataset = "symbol=LTCBTC&side=BUY&type=LIMIT&timeInForce=GTC&quantity=1&price=0.1&recvWindow=5000&timestamp=1499827319559";

  const sign = buildSign(dataset, apiSecret);

  // console.log(sign);

  //Get the balance of our tokens
  let headersmain = {
    headers: {
      'Content-Type': 'application/json',
      'X-MBX-APIKEY': apiKey
    }
  }

  let endpoint = apiRoot + process.env.BINANCE_ENDPOINT_ACCOUNT + "?" + dataset + "&signature=" + sign;

  let value = await getAxios(endpoint, headersmain);

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
