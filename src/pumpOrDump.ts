import { swap } from "./uniswap/swap";
import { initializeWallet } from "./utils/dexWallet";

import { loadPrettyConsole } from "./utils/prettyConsole";
import { updateConfig } from "./updateConfig";
const prettyConsole = loadPrettyConsole();
const token1 = process.argv[2];
const token2 = process.argv[3];
const action = process.argv[4];

const main = async () => {
  const config = await updateConfig();
  const dexWallet = await initializeWallet(config?.NETWORKS as string);
  await swap(dexWallet, [token1, token2], action == "pump" ? false : true);
};

main().then(() => {
  prettyConsole.log("Async operation completed");
});
