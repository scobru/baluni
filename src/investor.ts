import { initializeWallet } from "./utils/dexWallet"; // Import the initializeWallet function
import { TOKENS, WEIGHTS_UP, USDC } from "./config";
import { invest } from "./uniswap/invest";
import { POLYGON } from "./config";
import { rechargeFees } from "./utils/rechargeFees";
import { loadPrettyConsole } from "./utils/prettyConsole";

const prettyConsole = loadPrettyConsole();

const sellAll = Boolean(process.argv[3]);

async function investor() {
  prettyConsole.log("Sell All?", sellAll);
  try {
    await rechargeFees();
    // Initialize your DexWallet here
    const dexWallet = await initializeWallet(POLYGON[1]);
    await invest(dexWallet, WEIGHTS_UP, USDC, TOKENS, sellAll);
    prettyConsole.log("Investing operation completed");
  } catch (error) {
    prettyConsole.error("Error during initialization:", error);
  }
}

async function main() {
  await investor();
  prettyConsole.log("Rebalancer operation started");
}

main().catch((error) => {
  prettyConsole.error("An error occurred:", error);
});
