// set TOKENS and WEIGHTS

type ConfigType = {
  [key: number]: string;
};

type ConfigTypeYearn = {
  [key: number]: { [key: string]: any };
};

export const SELECTED_CHAINID = 137;

export const TOKENS = [
  "0x53E0bca35eC356BD5ddDFebbD1Fc0fD03FaBad39", // LINK
  "0x7ceb23fd6bc0add59e62ac25578270cff1b9f619", // WETH
  "0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6", // WBTC
  "0xb33eaad8d922b1083446dc23f610c2567fb5180f", // UNI
  "0xd6df932a45c0f255f85145f286ea0b292b21c90b", // AAVE
  "0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270", // WMATIC
  "0x9c2C5fd7b07E95EE044DDeba0E97a665F142394f", // 1INCH,
  "0x172370d5cd63279efa6d502dab29171933a610af", // CRV
  "0xc3c7d422809852031b44ab29eec9f1eff2a58756", // LDO
  "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174", // USDC
];

export const WEIGHTS_UP = {
  "0x53E0bca35eC356BD5ddDFebbD1Fc0fD03FaBad39": 1250,
  "0x7ceb23fd6bc0add59e62ac25578270cff1b9f619": 1000,
  "0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6": 2500,
  "0xb33eaad8d922b1083446dc23f610c2567fb5180f": 1000,
  "0xd6df932a45c0f255f85145f286ea0b292b21c90b": 1000,
  "0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270": 1000,
  "0x9c2C5fd7b07E95EE044DDeba0E97a665F142394f": 500,
  "0x172370d5cd63279efa6d502dab29171933a610af": 1000,
  "0xc3c7d422809852031b44ab29eec9f1eff2a58756": 500,
  "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174": 250,
};

export const WEIGHTS_DOWN = {
  "0x53E0bca35eC356BD5ddDFebbD1Fc0fD03FaBad39": 0,
  "0x7ceb23fd6bc0add59e62ac25578270cff1b9f619": 1000,
  "0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6": 2000,
  "0xb33eaad8d922b1083446dc23f610c2567fb5180f": 0,
  "0xd6df932a45c0f255f85145f286ea0b292b21c90b": 0,
  "0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270": 0,
  "0x9c2C5fd7b07E95EE044DDeba0E97a665F142394f": 0,
  "0x172370d5cd63279efa6d502dab29171933a610af": 0,
  "0xc3c7d422809852031b44ab29eec9f1eff2a58756": 0,
  "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174": 7000,
};

export const USDC: ConfigType = {
  137: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
}; // USDC
export const WNATIVE: ConfigType = {
  137: "0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270",
}; // WMATIC
export const NATIVE: ConfigType = {
  137: "0x0000000000000000000000000000000000001010",
}; // MATIC
export const WETH: ConfigType = {
  137: "0x7ceb23fd6bc0add59e62ac25578270cff1b9f619",
};
export const ORACLE: ConfigType = {
  137: "0x0AdDd25a91563696D8567Df78D5A01C9a991F9B8",
}; // 1INCH OFFHCAIN ORACLE
export const ROUTER: ConfigType = {
  137: "0xE592427A0AEce92De3Edee1F18E0157C05861564",
}; // UNIV3 ROUTER
export const QUOTER: ConfigType = {
  137: "0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6",
}; // UNIV3 QUOTER
export const NETWORKS: ConfigType = {
  137: "https://polygon-mainnet.g.alchemy.com/v2/u1t0bPCxL7FksVGLrMLW950RqujroHhP",
};

// YEARN
export const YEARN_ENABLED = true;
export const YEARN_VAULTS: ConfigTypeYearn = {
  137: {
    USDC: "0xA013Fbd4b711f9ded6fB09C1c0d358E2FbC2EAA0",
    WETH: "0x305F25377d0a39091e99B975558b1bdfC3975654",
    WMATIC: "0x28F53bA70E5c8ce8D03b1FaD41E9dF11Bb646c36",
  },
};

// REBALANCE SETTINGS
export const LIMIT = 50; // 1%
export const SLIPPAGE = 50; // 1%
export const INTERVAL = 300; // 1 minute
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
export const RSI_PERIOD = 4;
export const RSI_OVERBOUGHT = 70;
export const RSI_OVERSOLD = 30;
export const STOCKRSI_PERIOD = 14;
export const STOCKRSI_OVERBOUGHT = 80;
export const STOCKRSI_OVERSOLD = 20;
export const RSI_TIMEFRAME = "5m";
