import { initializeWallet } from "./dexWallet"; // Import the initializeWallet function
import { TOKENS, WEIGHTS, USDC } from "./config";
import { invest } from "./uniswap/invest";
import { POLYGON } from "./networks";

const sellAll = process.argv[2];

async function investor() {
  try {
    // Initialize your DexWallet here
    const dexWallet = await initializeWallet(POLYGON[0]);
    await invest(dexWallet, WEIGHTS, USDC, TOKENS, Boolean(sellAll);
  } catch (error) {)
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
