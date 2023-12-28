import { initializeWallet } from "./dexWallet";
import { rebalancePortfolio } from "./uniswap/rebalance";
import {
  TOKENS,
  WEIGHTS_UP,
  WEIGHTS_DOWN,
  WEIGHTS_NONE,
  USDC,
  INTERVAL,
} from "./config";
import { POLYGON } from "./networks";

async function rebalancer() {
  try {
    let selectedWeights = WEIGHTS_NONE;
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
          "15m",
          false
        ); // true if you want to get future market

        const trend = await kstCross(input, 10, 15, 20, 30, 10, 10, 10, 15, 9);
        console.log(trend);

        if (trend.direction == "up") {
          selectedWeights = WEIGHTS_UP;
        } else if (trend.direction === "down") {
          selectedWeights = WEIGHTS_DOWN;
        }
        console.log("Selected weights:", selectedWeights);
        await rebalancePortfolio(dexWallet, TOKENS, selectedWeights, USDC);
      } catch (error) {
        console.error("Error during rebalancing:", error);
      }
    }, INTERVAL * 1000); // 1 minute = 60000 ms
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
