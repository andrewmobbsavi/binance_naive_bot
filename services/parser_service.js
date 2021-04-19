class parser_service{
  /**
  * Calculates approx amount of currency we can buy with the tether we have
  *
  * @param orderBookAsks arr - Array of order book asks and volumes
  * @param tetherHeld float - amount of tether held in the account
  *
  */
  calculateBuyPriceAndAmount(orderBookAsks, tetherHeld, precision){

    var tetherTrack = tetherHeld;

    //loop through the order book and check for asks
    for(let i = 0; i < orderBookAsks.length; i++){
      let currentAsk = orderBookAsks[i][0] * orderBookAsks[i][1];

      //Subtract from the current tether amount
      tetherTrack -= currentAsk;

      //tetherTrack is less than zero when there is enough supply to buy
      if(tetherTrack < 0){
        let currentAmount = tetherHeld / orderBookAsks[i][0];
        currentAmount = currentAmount.toFixed(precision);
        return [orderBookAsks[i][0], currentAmount];
      }
    }

    throw "Unable to parse buy price";
  }
}

const parserService = new parser_service();

module.exports = parserService;
