import { initializeWallet } from "./dexWallet";
import { rebalancePortfolio } from "./uniswap/rebalance";
import { TOKENS, WEIGHTS, WEIGHTS_2, USDC } from "./config";
import { POLYGON } from "./networks";
import { invest } from "./uniswap/invest";

async function rebalancer() {
  try {
    // Initialize your DexWallet here
    const dexWallet = await initializeWallet(POLYGON[0]);
    // Set an interval to perform rebalancing every 5 minutes
    setInterval(async () => {
      try {
        console.log("Checking portfolio for rebalancing...");

        const {
          kstCross,
          getDetachSourceFromOHLCV,
        } = require("trading-indicator");

        const { input } = await getDetachSourceFromOHLCV(
          "binance",
          "BTC/USDT",
          "1h",
          false
        ); // true if you want to get future market

        const trend = await kstCross(input, 10, 15, 20, 30, 10, 10, 10, 15, 9);
        console.log(trend);

        if (trend.direction == "up" || trend.direction == "none") {
          await rebalancePortfolio(dexWallet, TOKENS, WEIGHTS, USDC);
        } else if (trend.direction == "down") {
          await invest(dexWallet, WEIGHTS_2, USDC, TOKENS, true);
          await rebalancePortfolio(dexWallet, TOKENS, WEIGHTS_2, USDC);
        }
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
