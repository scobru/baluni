import { swap } from "./uniswap/swap";
import { initializeWallet } from "./utils/dexWallet";
import { NETWORKS } from "./config";

import { loadPrettyConsole } from "./utils/prettyConsole";
const prettyConsole = loadPrettyConsole();
const token1 = process.argv[2];
const token2 = process.argv[3];
const action = process.argv[4];
const chainId = process.argv[5];

const main = async () => {
  const dexWallet = await initializeWallet(NETWORKS[Number(chainId)]);
  await swap(dexWallet, [token1, token2], action == "pump" ? false : true);
};

main().then(() => {
  prettyConsole.log("Async operation completed");
});
