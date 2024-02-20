import { initializeWallet } from "./utils/dexWallet"; // Import the initializeWallet function
import { TOKENS, WEIGHTS_UP, USDC, SELECTED_CHAINID } from "./config";
import { invest } from "./uniswap/invest";
import { NETWORKS } from "./config";
import { rechargeFees } from "./utils/rechargeFees";
import { loadPrettyConsole } from "./utils/prettyConsole";

const prettyConsole = loadPrettyConsole();

const sellAll = Boolean(process.argv[3]);

async function investor(chainId: number) {
  prettyConsole.log("Sell All?", sellAll);
  try {
    const dexWallet = await initializeWallet(NETWORKS[chainId]);
    await rechargeFees(dexWallet);
    // Initialize your DexWallet here
    await invest(dexWallet, WEIGHTS_UP, USDC[chainId], TOKENS, sellAll);
    prettyConsole.log("Investing operation completed");
  } catch (error) {
    prettyConsole.error("Error during initialization:", error);
  }
}

async function main() {
  await investor(SELECTED_CHAINID);
  prettyConsole.log("Rebalancer operation started");
}

main().catch(error => {
  prettyConsole.error("An error occurred:", error);
});
