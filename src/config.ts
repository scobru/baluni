// set TOKENS and WEIGHTS

export const TOKENS = [
  "0x53E0bca35eC356BD5ddDFebbD1Fc0fD03FaBad39", // LINK
  "0x7ceb23fd6bc0add59e62ac25578270cff1b9f619", // WETH
  "0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6", // WBTC
  "0xb33eaad8d922b1083446dc23f610c2567fb5180f", // UNI
  "0xd6df932a45c0f255f85145f286ea0b292b21c90b", // AAVE
  "0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270", // WMATIC
  "0x50b728d8d964fd00c2d0aad81718b71311fef68a", // SNX
  "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174", // USDC
];

export const WEIGHTS_UP = {
  "0x53E0bca35eC356BD5ddDFebbD1Fc0fD03FaBad39": 1000,
  "0x7ceb23fd6bc0add59e62ac25578270cff1b9f619": 2000,
  "0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6": 3000,
  "0xb33eaad8d922b1083446dc23f610c2567fb5180f": 1000,
  "0xd6df932a45c0f255f85145f286ea0b292b21c90b": 1000,
  "0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270": 1000,
  "0x50b728d8d964fd00c2d0aad81718b71311fef68a": 1000,
  "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174": 0,
};

export const WEIGHTS_NONE = {
  "0x53E0bca35eC356BD5ddDFebbD1Fc0fD03FaBad39": 1000,
  "0x7ceb23fd6bc0add59e62ac25578270cff1b9f619": 2000,
  "0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6": 2000,
  "0xb33eaad8d922b1083446dc23f610c2567fb5180f": 1000,
  "0xd6df932a45c0f255f85145f286ea0b292b21c90b": 1000,
  "0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270": 1000,
  "0x50b728d8d964fd00c2d0aad81718b71311fef68a": 1000,
  "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174": 1000,
};

export const WEIGHTS_DOWN = {
  "0x53E0bca35eC356BD5ddDFebbD1Fc0fD03FaBad39": 0,
  "0x7ceb23fd6bc0add59e62ac25578270cff1b9f619": 1000,
  "0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6": 1000,
  "0xb33eaad8d922b1083446dc23f610c2567fb5180f": 0,
  "0xd6df932a45c0f255f85145f286ea0b292b21c90b": 0,
  "0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270": 0,
  "0x50b728d8d964fd00c2d0aad81718b71311fef68a": 0,
  "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174": 8000,
};

export const USDC = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174"; // USDC
export const WNATIVE = "0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270"; // WMATIC
export const NATIVE = "0x0000000000000000000000000000000000001010"; // MATIC

export const ORACLE = "0x0AdDd25a91563696D8567Df78D5A01C9a991F9B8"; // CHAINLINK OFFHCAIN ORACLE
export const ROUTER = "0xE592427A0AEce92De3Edee1F18E0157C05861564"; // UNIV3 ROUTER
export const QUOTER = "0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6"; // UNIV3 QUOTER

export const LIMIT = 100; // 1%
export const SLIPPAGE = 100; // 1%
export const INTERVAL = 120; // 1 minute
