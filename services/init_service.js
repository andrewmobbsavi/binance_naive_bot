class init_service{

  constructor(){
    const argsGet = process.argv;
    const appEnv = argsGet[2];
    const currency = argsGet[3];

    this.currency = currency;

    this.appEnv = appEnv;

    this.apiKey = process.env.TEST_BINANCE_API_KEY;
    this.apiSecret = process.env.TEST_BINANCE_SECRET_KEY;
    this.apiRoot = process.env.TEST_BINANCE_API_ROOT;

    if(appEnv == process.env.LIVE_ENVIRONMENT){
      this.apiKey = process.env.BINANCE_API_KEY;
      this.apiSecret = process.env.BINANCE_SECRET_KEY;
      this.apiRoot = process.env.LIVE_BINANCE_API_ROOT;
    }

    this.compare_ticker = process.env.BNB_USDT;
    this.main_ticker = process.env.BNB_SYMBOL;
    this.precision = process.env.BNB_PRECISION;

    if(currency == process.env.BTC_SYMBOL){
      this.compare_ticker = process.env.BTC_USDT;
      this.main_ticker = process.env.BTC_SYMBOL;
      this.precision = process.env.BTC_PRECISION;
    } else if(currency == process.env.ETH_SYMBOL){
      this.compare_ticker = process.env.ETH_USDT;
      this.main_ticker = process.env.ETH_SYMBOL;
      this.precision = process.env.ETH_PRECISION;
    }
  }

}

const initService = new init_service();
module.exports = initService;
