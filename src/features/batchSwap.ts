import { batchSwap } from "../scripts/uniswap/actions/swap";
import { DexWallet, initializeWallet } from "../utils/dexWallet";
import { loadPrettyConsole } from "../utils/prettyConsole";
import { updateConfig } from "../config/updateConfig";
const prettyConsole = loadPrettyConsole();

const main = async () => {
  const config = await updateConfig();
  const dexWallet: DexWallet = await initializeWallet(config?.NETWORKS as string);

  const swaps = [
    {
      dexWallet: dexWallet,
      token0: "USDC.E",
      token1: "UNI",
      reverse: false,
      protocol: "uni-v3",
      chainId: "137",
      amount: "0.0001", // Change the type of amount from number to string
      slippage: 100,
    },
    {
      dexWallet: dexWallet,
      token0: "WMATIC",
      token1: "UNI",
      reverse: true,
      protocol: "uni-v3",
      chainId: "137",
      amount: "0.0001", // Change the type of amount from number to string
      slippage: 100,
    },
  ];

  await batchSwap(swaps);
};

main().then(() => {
  prettyConsole.log("Async operation completed");
});
