import { swap } from "../../common/uniswap/swap";
import { initializeWallet } from "../../utils/web3/dexWallet";
import { loadPrettyConsole } from "../../utils/prettyConsole";
import { NETWORKS } from "baluni-api";
import { token0, token1, action, protocol, chainId, amount, slippage } from "./config";
const prettyConsole = loadPrettyConsole();

const main = async () => {
  const dexWallet = await initializeWallet(NETWORKS[chainId]);
  await swap(dexWallet, token0, token1, action == "pump" ? false : true, protocol, chainId, amount, slippage);
};

main().then(() => {
  prettyConsole.log("Async operation completed");
});
