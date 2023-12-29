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
import { predict } from "./predict/predict";

async function rebalancer() {
  try {
    const selectedWeightsInput = String(process.argv[2]);

    let selectedWeights = WEIGHTS_NONE;
    console.log("Selected weights input:", selectedWeightsInput);

    if (selectedWeightsInput === "up") {
      selectedWeights = WEIGHTS_UP;
    } else if (selectedWeightsInput === "down") {
      selectedWeights = WEIGHTS_DOWN;
    } else {
      selectedWeights = WEIGHTS_NONE;
    }

    console.log("Selected weights:", selectedWeights);

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

        // kstCross(input, roc1, roc2, roc3, roc4, sma1, sma2, sma3, sma4, signalPeriod)
        // Calculate KST
        const trend = await kstCross(input, 10, 15, 20, 30, 10, 10, 10, 15, 9);
        console.log(trend);

        // Calculate AI signal
        let signalAI;
        const linearRegression: any = await predict();

        if (linearRegression.predicted > linearRegression.actual) {
          signalAI = "up";
        } else {
          signalAI = "down";
        }

        // Calculate final signal
        if (trend.direction == "up" && signalAI == "up") {
          selectedWeights = WEIGHTS_UP;
        } else if (trend.direction === "down" || signalAI == "down") {
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
