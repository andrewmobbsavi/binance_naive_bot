# binance_naive_bot
A Naive Trading bot which buys low and sells high using Tether. Bullish Only. Current incarnation will get stuck with the bags at all time highs. 
Good for bullish trading or consolidation trading. Needs refactoring and tweaking. 

Setup instructions:

1. npm install
2. cp .env.bk .env
3. Add your binance API keys to the .env file 

The node command uses argv parameters. 

node index.js environment CURRENCY
-----------------------------------
examples:
node index.js local ETH
node index.js live BNB

Currently only BNB and ETH are supported. Other currencies can be easily added. 

To run in a live environment, use nohup:

nohup node index.js live BNB &

This will allow the script to continue to run after the terminal has closed.

