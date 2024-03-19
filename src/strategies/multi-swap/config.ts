export const SWAPS = [
  {
    dexWallet: dexWallet,
    token0: "USDC.E",
    token1: "UNI",
    reverse: false,
    protocol: "uni-v3",
    chainId: 137,
    amount: "0.0001", // Change the type of amount from number to string
    slippage: 100,
  },
  {
    dexWallet: dexWallet,
    token0: "WMATIC",
    token1: "UNI",
    reverse: true,
    protocol: "uni-v3",
    chainId: 137,
    amount: "0.0001", // Change the type of amount from number to string
    slippage: 100,
  },
];
export const SELECTED_CHAINID = 137;
