# BALUNI 🎈

BALUNI is an application for trading on decentralized exchanges. It is composed of various modules that can be activated and deactivated, allowing for a customizable trading strategy based on technical analysis and other financial instruments.

## Installation

```shell
npm install
```

## Usage

### Main process

```shell
npm start
```

### Modular Features of BALUNI

BALUNI's trading strategy is modular and can be customized by activating or deactivating the following modules:

1. **Linear Prediction on 1H BTC Timeframe:** This module uses linear regression to predict the price movement of Bitcoin on a 1-hour timeframe, helping to make informed trading decisions.

2. **RSI and StochRSI Technical Analysis on Buy and Sell:** Implements the Relative Strength Index (RSI) and Stochastic RSI indicators to determine overbought or oversold conditions, informing when to buy or sell.

3. **Using KST Indicator to Catch the Trend of Bitcoin:** The Know Sure Thing (KST) indicator is a momentum oscillator used to identify major trends in the price of Bitcoin, providing a comprehensive view of its bullish or bearish tendencies.

4. **Using USDC with Yearn to Create Interest on USDC:** Leverages Yearn Finance to earn interest on USDC holdings, optimizing the value of idle assets between trades.

### Additional Tools

#### Investor for Uniswap

Edit the configuration file **src/config.ts** with your tokens and weights
Select "true" or "false" if you want to sell all the tokens balance before reinvestment.

```shell
npx ts-node  src/investor.ts <sellAll?>
```

Examples:

```shell
npx ts-node  src/investor.ts true
```

#### Rebalancer for Uniswap

Edit the configuration file **src/config.ts** with your tokens and weights

```shell
npx ts-node  src/rebalancer.ts 
```

#### Dollar-Cost Averaging (DCA)

The DCA module allows the user to periodically invest a fixed amount in tokens over time, reducing the impact of volatility. It is set up with a configuration that includes the investment amount, tokens, and intervals.

To use the DCA module, edit the investment configuration in src/config.ts with your desired tokens, investment amounts, and intervals. Execute the script via:

```shell
npx ts-node src/dca.ts 
```

#### Market Prediction (DCA)

This module uses historical price data to predict future price movements of tokens, employing techniques like linear regression. It aims to inform trading decisions by anticipating market trends.

Ensure the prediction settings are correctly configured in src/config.ts. To run the prediction module, use the following command:

```shell
npx ts-node src/predict.ts bitcoin
```

#### Pump-and-dump tool for Uniswap

This tool buys or sells the entire balance of a specified token in the pair

```shell
npx ts-node src/pumpOrDump.ts <token1> token2> <action>
```

Command line arguments:

token1: Reserve token name if configured (eg. WBNB) or token contract address <br />
token2: Shit token's name if configured (eg. DARK) or token contract address <br />
action: 'pump' | 'dump' <br />

- Pump sells all of token1 for token2
- Dump reverses the pump selling all of token2 for token1

Examples:

```shell
npx ts-node  src/pumpOrDump.ts 0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c 0xBc7d6B50616989655AfD682fb42743507003056D pump
npx ts-node  src/pumpOrDump.ts 0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c 0xBc7d6B50616989655AfD682fb42743507003056D dump
```

#### Getting a transaction receipt

A tool for getting a transaction receipt

```shell
npx ts-node  src/getTxReceipt.ts 0xf90efa044b4a5c5a0da0ba1c9dc3c7a5e53962818c6a7a0d496abcab759736fb
```
