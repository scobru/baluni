import { batchSwap } from "../../common/uniswap/batchSwap";
import { DexWallet, initializeWallet } from "../../utils/web3/dexWallet";
import { loadPrettyConsole } from "../../utils/prettyConsole";
import { SWAPS } from "./config";
import { SELECTED_CHAINID } from "./config";
import { NETWORKS } from "baluni-api";

const pc = loadPrettyConsole();

const main = async () => {
  const dexWallet: DexWallet = await initializeWallet(NETWORKS[SELECTED_CHAINID]);

  await batchSwap(SWAPS);
};

main().then(() => {
  pc.log("Async operation completed");
});
