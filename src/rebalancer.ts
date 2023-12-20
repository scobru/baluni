import { initializeWallet } from "./dexWallet"; // Import the initializeWallet function
import { rebalancePortfolio } from "./uniswap/rebalance";
import { TOKENS, WEIGHTS, USDT } from "./config";

async function rebalancer() {
  try {
    // Initialize your DexWallet here
    const dexWallet = await initializeWallet(/* necessary parameters */);

    // Set an interval to perform rebalancing every 5 minutes
    setInterval(async () => {
      try {
        console.log("Checking portfolio for rebalancing...");
        await rebalancePortfolio(dexWallet, TOKENS, WEIGHTS, USDT);
      } catch (error) {
        console.error("Error during rebalancing:", error);
      }
    }, 300000); // 300000 milliseconds = 5 minutes
  } catch (error) {
    console.error("Error during initialization:", error);
  }
}

async function main() {
  await rebalancer();
  console.log("Rebalancer operation started");
}

main().catch((error) => {
  console.error("An error occurred:", error);
});
