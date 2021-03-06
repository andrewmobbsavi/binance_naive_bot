// require('dotenv').config();

const axios = require('axios');

//store data
const fs = require('fs');

//TESTING
// var results = [];
// results[0] = {data:{bitcoin:{usd:60000}}}
// let increaser = false;
// var intervalCount = 0;
//END TESTING

//Amount of money
const stackBase = 1000;
var stack = stackBase;

var stackrecords = [];

//TEST DATA
const data = fs.readFileSync('ethdata.txt', 'utf8');
const dataSplit = data.split('\n');

const testfile = fs.readFileSync('test.txt','utf8');


//END TEST DATA

// throw new Error("DIE");

//tracks the price we are currently on
var priceTracker = null;
var holding = false;
var buyTracker = null; //track currently held values

//Run in setinterval
const tick = async(config, marketPrice) => {

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


  var timestamp = Number(new Date());
  var dateShow = new Date(timestamp).toDateString();

  const { asset, compare, buyPercentage, sellPercentage } = config;


  // const results = await Promise.all([
  //   axios.get('https://api.coingecko.com/api/v3/simple/price?ids='+asset+'&vs_currencies='+compare).catch(function (error) {
  //     if (error.response) {
  //       // Request made and server responded
  //       console.log(error.response.data);
  //       console.log(error.response.status);
  //       console.log(error.response.headers);
  //     } else if (error.request) {
  //       // The request was made but no response was received
  //       console.log(error.request);
  //     } else {
  //       // Something happened in setting up the request that triggered an Error
  //       console.log('Error', error.message);
  //     }
  //     fs.appendFileSync('errors.txt', dateShow + "  Error!");
  //   })
  // ]);



  //results
  // const marketPrice = results[0].data.bitcoin.usd;

  if (!priceTracker){
    priceTracker = marketPrice;
  }

  //Run if
  //If holding, don't care about the priceTracker, only care about buyTracker
  if(holding){
    //Get the difference
    //The diff will be negative if price has risen, positive if price has fallen
    let priceDiff = buyTracker - marketPrice;

    let increase = false;

    if(priceDiff < 0){
      increase = true;
    }

    let priceDiffRatio = Math.abs(priceDiff / buyTracker);

    //Different criteria for profit vs loss

    //SELL
    if(increase && (priceDiffRatio >= sellPercentage)){

      //Total remaining in stack
      let profit = stack * priceDiffRatio;
      stack = stack + profit;

      // console.log("SELL! " + profit);

      let msgString = `${dateShow} SELL BTC @: $${marketPrice}. Profit $${profit}. Stack $${stack} ${priceDiffRatio}\r\n`;

      // fs.appendFileSync('trades.txt', msgString);

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

    if(priceDiff > 0){
      decrease = true;
    }

    let priceDiffRatio = Math.abs(priceDiff / priceTracker);

    //Different criteria for profit vs loss
    //BUY
    if(decrease && (priceDiffRatio >= buyPercentage)){
      let msgString = `${dateShow} BUY BTC @: $${marketPrice}\r\n`;

      // fs.appendFileSync('trades.txt', msgString);

      buyTracker = marketPrice
      priceTracker = marketPrice;
      holding = true;

      // console.log(msgString);
    }

    //Set pricetracker logic
    /*
      if previous vs current market higher than 1% increase, then reset
    */
    if(!decrease && priceDiffRatio > buyPercentage){
      priceTracker = marketPrice;
    }
  }


  // console.log(`
  //   Current: ${asset} $${marketPrice}... Pricetracker: $${priceTracker}
  // `);

  //Add records
  let msgString = `${dateShow} BTC: $${marketPrice}\r\n`;
  // fs.appendFileSync('history.txt', msgString);


};


// const run = () => {
//   const config = {
//     asset: 'bitcoin',
//     compare: 'usd',
//     buyPercentage: 0.01, //%fall to buy
//     sellPercentage: 0.005, //% rise to buy
//     tickInterval: 50000
//   };
//
//
//   setInterval(tick, config.tickInterval, config);
//
// };
//
// run();

var config = {
  asset: 'ethereum',
  compare: 'usd',
  buyPercentage: 0.01, //%fall to buy
  sellPercentage: 0.005, //% rise to buy
  tickInterval: 0.1
};

const buyTest = 0.01;
const sellTest = 0.016;
const increment = 0.001;
const startPoint = 0.005;
//loop through percentages
//buyloop
for(let x = startPoint; x <= buyTest; x += increment){
  //sell loop
  for(let y = startPoint; y <= sellTest; y += increment){
    //reset the amount invested
    stack = stackBase;
    priceTracker = null;
    holding = false;
    buyTracker = null; //track currently held values

    config['buyPercentage'] = x;
    config['sellPercentage'] = y;

    //loop through all data elements in the data file
    for(let i = 0; i < dataSplit.length; i++){

      tick(config, dataSplit[i]);

    }

    if(stack > stackBase && stack < (stackBase * 100)){
      let stackData = {
        stack: Math.floor(stack * 1000) / 1000,
        buyInc: Math.floor(x * 1000) / 1000,
        sellInc: Math.floor(y * 1000) / 1000
      }
      //record the stack
      stackrecords.push(stackData);

    }

  }
}

function compare( a, b ) {
  if ( a.stack < b.stack ){
    return 1;
  }
  if ( a.stack > b.stack ){
    return -1;
  }
  return 0;
}

stackrecords.sort( compare );

console.log(stackrecords);
