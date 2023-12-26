import { initializeWallet } from "./dexWallet";
import { rebalancePortfolio } from "./uniswap/rebalance";
import { TOKENS, WEIGHTS, USDC } from "./config";
import { POLYGON } from "./networks";

async function rebalancer() {
  try {
    // Initialize your DexWallet here
    const dexWallet = await initializeWallet(POLYGON[0]);
    // Set an interval to perform rebalancing every 5 minutes
    setInterval(async () => {
      try {
        console.log("Checking portfolio for rebalancing...");
        await rebalancePortfolio(dexWallet, TOKENS, WEIGHTS, USDC);
      } catch (error) {
        console.error("Error during rebalancing:", error);
      }
    }, 120000); // 1 minute = 60000 ms
  } catch (error) {
    console.error("Error during initialization:", error);
  }
}

async function main() {
  await rebalancer();
}

main().catch((error) => {
  console.error("An error occurred:", error);
});
