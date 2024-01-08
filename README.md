# BALUNI 🎈

## Project Description

BALUNI is an innovative application designed for trading on decentralized exchanges. It offers a range of tools to facilitate trading activities on platforms like Uniswap. BALUNI is tailored to assist both new and experienced traders in managing their cryptocurrency portfolios with ease.

## Prerequisites

Before installing BALUNI, ensure you have Node.js and npm installed on your system.

## Installation

To install BALUNI, follow these simple steps:

```shell
npm install
```

## Usage

### Main Process

Start BALUNI using the following command:

```shell
npm start
```

### Modular Features of BALUNI

BALUNI offers a versatile trading strategy that allows for customization by activating or deactivating the following modules:

1. **Linear Prediction on 1H BTC Timeframe:** This module employs linear regression to forecast the price movement of Bitcoin on a 1-hour timeframe, empowering informed trading decisions.
2. **RSI and StochRSI Technical Analysis on Buy and Sell:** By utilizing the Relative Strength Index (RSI) and Stochastic RSI indicators, this module determines overbought or oversold conditions, guiding optimal buy and sell actions.
3. **Using KST Indicator to Capture Bitcoin Trends:** By leveraging the Know Sure Thing (KST) indicator, this module identifies major price trends in Bitcoin, providing valuable insights into bullish or bearish tendencies.
4. **Using USDC with Yearn to Generate Interest on USDC:** This module optimizes the value of idle assets between trades by utilizing Yearn Finance to earn interest on USDC holdings.

These modular features elevate the trading experience on BALUNI, offering flexibility and empowering traders with advanced tools for success.

## Additional Tools

### Investor for Uniswap

Edit the configuration file **src/config.ts** with your tokens and weights Select "true" or "false" if you want to sell all the tokens balance before reinvestment.

```shell
npx ts-node src/investor.ts <sellAll?>
```

Examples:

```shell
npx ts-node src/investor.ts true
```

### Rebalancer for Uniswap

Edit the configuration file **src/config.ts** with your token and weights

```shell
npx ts-node src/rebalancer.ts
```

### Dollar-Cost Averaging (DCA)

The DCA module allows the user to periodically invest a fixed amount in tokens over time, reducing the impact of volatility. It is set up with a configuration that includes the investment amount, tokens, and intervals.

To use the DCA module, edit the investment configuration in src/config.ts with your desired tokens, investment amounts, and intervals. Execute the script via:

```shell
npx ts-node src/dca.ts 
```

### Market Prediction (DCA)

This module uses historical price data to predict future price movements of tokens, employing techniques like linear regression. It aims to inform trading decisions by anticipating market trends.

Ensure the prediction settings are correctly configured in src/config.ts. To run the prediction module, use the following command:

```shell
npx ts-node src/predict.ts bitcoin
```

### Pump-and-dump tool for Uniswap

This tool buys or sells the entire balance of a specified token in the pair

```shell
npx ts-node src/pumpOrDump.ts <token1> <token2> <action>
```

Command line arguments::

- token1: Reserve token name if configured (eg. WBNB) or token contract address  
- token2: Shit token's name if configured (eg. DARK) or token contract address  
- action: 'pump' | 'dump'

Examples:

```shell
npx ts-node src/pumpOrDump.ts 0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c 0xBc7d6B50616989655AfD682fb42743507003056D pump
npx ts-node src/pumpOrDump.ts 0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c 0xBc7d6B50616989655AfD682fb42743507003056D dump
```

  
### Getting a transaction receipt

A tool for getting a transaction receipt:

```shell
npx ts-node src/getTxReceipt.ts 0xf90efa044b4a5c5a0da0ba1c9dc3c7a5e53962818c6a7a0d496abcab759736fb
```
 
## Configuration Details

In `src/config.ts`, you can set various parameters for trading strategies. This includes token selections, weights, and whether to sell all tokens before reinvesting.

## Contributing to BALUNI

We welcome contributions! Please submit pull requests with your proposed changes. Adhere to our coding standards and guidelines for a smooth collaboration process.

## License

BALUNI is released under [[LICENSE|GNU AGPLv3]], which details how it can be used and distributed.

## Contact and Support

For support or to join our community, join our [Telegram Group](https://t.me/+yWNEe13B5pcyNDBk)

For troubleshooting common issues, visit [GitHub Issues](https://github.com/plancia/baluni/issues).```shell
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
