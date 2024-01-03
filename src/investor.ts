import { initializeWallet } from "./dexWallet"; // Import the initializeWallet function
import { TOKENS, WEIGHTS_NONE, USDC } from "./config";
import { invest } from "./uniswap/invest";
import { POLYGON } from "./networks";
import { rechargeFees } from "./uniswap/rechargeFees";
import { loadPrettyConsole } from "./utils/prettyConsole";

const prettyConsole = loadPrettyConsole();

const sellAll = Boolean(process.argv[3]);

async function investor() {
  prettyConsole.log("Sell All?", sellAll);
  try {
    await rechargeFees();
    // Initialize your DexWallet here
    const dexWallet = await initializeWallet(POLYGON[1]);
    await invest(dexWallet, WEIGHTS_NONE, USDC, TOKENS, sellAll);
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
