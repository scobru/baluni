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
yarn invest <sellAll?>
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
yarn dca 
```

### Market Prediction (DCA)

This module uses historical price data to predict future price movements of tokens, employing techniques like linear regression. It aims to inform trading decisions by anticipating market trends.

Ensure the prediction settings are correctly configured in src/config.ts. To run the prediction module, use the following command:

```shell
yarn predict bitcoin 
```

### Pump-and-dump tool for Uniswap

This tool buys or sells the entire balance of a specified token in the pair

```shell
yarn pumpOrDump <token1> <token2> <action>
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

### Tokens and Weights

#### 1. **TOKENS**

- This array lists the addresses of the tokens you are working with.
- Example Tokens:
  - LINK (`0x53E0bca35eC356BD5ddDFebbD1Fc0fD03FaBad39`)
  - WETH (`0x7ceb23fd6bc0add59e62ac25578270cff1b9f619`)
  - and others...
- **To Modify**: Replace these with the token addresses relevant to your strategy.

#### 2. **WEIGHTS_UP** and **WEIGHTS_DOWN**

- These objects define the weights for each token when the price is going up (`WEIGHTS_UP`) and down (`WEIGHTS_DOWN`).
- The weights are in an integer format, which presumably represents their relative importance or allocation in the strategy.
- **To Modify**: Adjust the values to change the weighting of each token under different market conditions.

### Contract Addresses

#### 3. **Stablecoins and Native Tokens**

- `USDC`, `WNATIVE`, and `NATIVE` are set to their respective contract addresses.
- **To Modify**: Update these if you are using different tokens or networks.

#### 4. **Oracle and Router**

- `ORACLE` and `ROUTER` define the addresses for 1Inch OffChain Oracle and Uniswap v3 Router, respectively.
- **To Modify**: Change these addresses if you're using different services or versions.

### Operational Parameters

#### 5. **Limits and Intervals**

- `LIMIT`, `SLIPPAGE`, and `INTERVAL` define operational parameters like transaction limits and intervals.
- **To Modify**: Adjust these values based on your risk management and operational strategy.

#### 6. **Yearn Finance Integration**

- `YEARN_ENABLED` and `YEARN_AAVE_V3_USDC` allow integration with Yearn Finance, specifically for USDC in this example.
- **To Modify**: Change to `false` to disable or update the Yearn vault address.

In this release we use this Yearn Vault: [USDC.e-A AAVE on Polygon](https://yearn.fi/v3/137/0xA013Fbd4b711f9ded6fB09C1c0d358E2FbC2EAA0)

### Strategy Parameters

#### 7. **Dollar-Cost Averaging (DCA)**

- `INVESTMENT_INTERVAL` and `INVESTMENT_AMOUNT` define the frequency and amount for DCA.
- **To Modify**: Adjust these to align with your DCA strategy.

#### 8. **Trend Following and Linear Regression**

- Enables trend following and linear regression analysis.
- Adjust `LINEAR_REGRESSION_PERIOD` and `LINEAR_REGRESSION_EPOCHS` for your analysis period and epochs.
- **To Modify**: Toggle `true`/`false` to enable/disable and adjust parameters for your analysis needs.

#### 9. **Technical Analysis**

- Configures parameters for RSI and Stochastic RSI.
- Includes periods and thresholds for overbought/oversold conditions.
- **To Modify**: Adjust these to suit your technical analysis criteria.

## Workflow Overview

1. **Bot Start**
   - Initialize the trading bot.

2. **Check Linear Regression**
   - Perform linear regression analysis to understand market trends.

3. **Check KST Trend**
   - Assess the Know Sure Thing (KST) trend signal to predict the market momentum.

4. **Select Weight Based on Trend Signal**
   - Choose the asset allocation weight according to the trend signal.

5. **Distribute Assets**
   - Allocate assets based on the selected weights.

6. **Technical Analysis Upon Rebalance**
   - When a rebalance occurs, conduct technical analysis using signals like RSI (Relative Strength Index) and Stochastic RSI.

7. **Deposit into Yearn Vault**
   - If rebalancing is not trigger, deposit USDC into the Yearn vault to accrue interest.

8. **Withdraw from Vault for Trade upon Rebalance**
   - When rebalancing takes place, withdraw USDC from the vault to use for trading.

## Workflow Diagram

```plaintext
1. START
   |
   |─> Trend Selection
   |    ├─> Linear Regression
   |    └─> KST
   |        └─> UP/DOWN
   |            ├─> Weight UP
   !            └─> Weight DOWN
2. Distribute Assets
   |
   |─> Check for Rebalance
   |    │
   |    └─> Technical Analysis  
   |        └──> RSI/STOCHRSI
   |                 ├─> false
   |                 └─> true
   |                         └─> TRADE
3. Earn
   │
   └─> Rebalance?
            ├─> false
            |     └─> Have USDC Balance?
            |              └─> Deposit to Yearn
            |
            └─> true ─────> Withdraw from Yearn
```

## Tips for Configuration

- **Understand Each Parameter**: Before modifying any values, ensure you understand what each parameter does and how it impacts your trading strategy.
- **Test Changes**: Make changes incrementally and test the impact of each change.
- **Network Compatibility**: Ensure that all contract addresses are compatible with the network you are using (e.g., Ethereum, Polygon).
- **Pools and Tokens**: Verify that each token you're using has an associated liquidity pool on Uniswap V3, paired with either USDC or WMATIC, on your chosen network.
- **Stay Updated**: Keep your configurations up to date with the latest changes in the DeFi space.

## Contributing to BALUNI

We welcome contributions! Please submit pull requests with your proposed changes. Adhere to our coding standards and guidelines for a smooth collaboration process.

## Inspired

This project was ispired by following project: <https://github.com/vhalme/dex-bot>

## License

BALUNI is released under [GNU AGPLv3](LICENSE.md), which details how it can be used and distributed.

## Contact and Support

For support or to join our community, join our [Telegram Group](https://t.me/+yWNEe13B5pcyNDBk)

For troubleshooting common issues, visit [GitHub Issues](https://github.com/plancia/baluni/issues).
