import { initializeWallet } from "./dexWallet"; // Import the initializeWallet function
import { TOKENS, WEIGHTS_NONE, USDC } from "./config";
import { invest } from "./uniswap/invest";
import { POLYGON } from "./networks";
import { rechargeFees } from "./uniswap/rechargeFees";

const sellAll = Boolean(process.argv[3]);

async function investor() {
  console.log("Sell All?", sellAll);
  try {
    await rechargeFees();
    // Initialize your DexWallet here
    const dexWallet = await initializeWallet(POLYGON[1]);
    await invest(dexWallet, WEIGHTS_NONE, USDC, TOKENS, sellAll);
    console.log("Investing operation completed");
  } catch (error) {
    console.error("Error during initialization:", error);
  }
}

async function main() {
  await investor();
  console.log("Rebalancer operation started");
}

main().catch((error) => {
  console.error("An error occurred:", error);
});
