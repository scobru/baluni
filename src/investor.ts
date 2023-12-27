import { initializeWallet } from "./dexWallet"; // Import the initializeWallet function
import { TOKENS, WEIGHTS_UP, USDC } from "./config";
import { invest } from "./uniswap/invest";
import { POLYGON } from "./networks";

const sellAll = String(process.argv[2]) === "true" ? "true" : "false";

async function investor() {
  try {
    // Initialize your DexWallet here
    const dexWallet = await initializeWallet(POLYGON[0]);

    await invest(dexWallet, WEIGHTS_UP, USDC, TOKENS, Boolean(sellAll));
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
