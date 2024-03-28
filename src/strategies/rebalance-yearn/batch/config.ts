// set TOKENS and WEIGHTS

type ConfigTypeYearn = {
  [key: number]: { [key: string]: any };
};

export const SELECTED_PROTOCOL = "uni-v3";

export const SELECTED_CHAINID = 137;

export const TOKENS = [
  "LINK", // LINK
  "WETH", // WETH
  "WBTC", // WBTC
  "UNI", // UNI
  "AAVE", // AAVE
  "WMATIC", // WMATIC
  "CRV", // CRV
  "USDC.E", // USDC
];
export const WEIGHTS_UP = {
  LINK: 1000,
  WETH: 1000,
  WBTC: 3750,
  UNI: 1000,
  AAVE: 1500,
  WMATIC: 1000,
  CRV: 500,
  "USDC.E": 250,
};
export const WEIGHTS_DOWN = {
  LINK: 0,
  WETH: 1000,
  WBTC: 2000,
  UNI: 0,
  AAVE: 0,
  WMATIC: 0,
  CRV: 0,
  "USDC.E": 7000,
};

// YEARN CONFIG
export const YEARN_ENABLED = true;

export const YEARN_VAULTS: ConfigTypeYearn = {
  137: {
    USDC: {
      strategy: "multi",
      boosted: false,
    },
    WETH: {
      strategy: "multi",
      boosted: true,
    },
    WMATIC: {
      strategy: "multi",
      boosted: true,
    },
  },
};

// REBALANCE STRATEGY
export const LIMIT = 10; // 10/10000 = 0.1%
export const SLIPPAGE = 1000; // 3% 300 / 10000
export const INTERVAL = 300000; // 5 minute
export const MAX_APPROVAL = true;

// DCA
export const INVESTMENT_INTERVAL = 1 * 24 * 60 * 60 * 1000; // 1 day
export const INVESTMENT_AMOUNT = 100;

// KST
export const TREND_FOLLOWING = true;
export const KST_TIMEFRAME = "1h";

// AI
export const PREDICTION = false;
export const PREDICTION_PERIOD = 90;
export const PREDICTION_EPOCHS = 100;
export const PREDICTION_SYMBOL = "bitcoin";
export const PREDICTION_ALGO = "REGR";

// TECHNICAL ANALYSIS
export const TECNICAL_ANALYSIS = false;
//RSI
export const RSI_PERIOD = 4;
export const RSI_OVERBOUGHT = 70;
export const RSI_OVERSOLD = 30;
export const RSI_TIMEFRAME = "5m";

//STOCKRSI
export const STOCKRSI_PERIOD = 14;
export const STOCKRSI_OVERBOUGHT = 80;
export const STOCKRSI_OVERSOLD = 20;
