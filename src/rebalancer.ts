import { initializeWallet } from "./dexWallet";
import { rebalancePortfolio } from "./uniswap/rebalance";
import { TOKENS, WEIGHTS_UP, WEIGHTS_DOWN, USDC, INTERVAL } from "./config";
import { POLYGON } from "./networks";
import { predict } from "./predict/predict";
import { PrettyConsole } from "./utils/prettyConsole";

const prettyConsole = new PrettyConsole();

prettyConsole.clear();
prettyConsole.closeByNewLine = true;
prettyConsole.useIcons = true;

async function rebalancer() {
  try {
    // Initialize your DexWallet here
    const dexWallet = await initializeWallet(POLYGON[0]);
    let selectedWeights = WEIGHTS_UP;

    // Set an interval to perform rebalancing every 5 minutes
    setInterval(async () => {
      try {
        prettyConsole.log("Checking portfolio");
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
        prettyConsole.debug("KST:", trend);

        // Calculate AI signal
        let signalAI;
        const linearRegression: any = await predict();

        if (linearRegression.predicted > linearRegression.actual) {
          signalAI = "up";
        } else {
          signalAI = "down";
        }

        console.group();
        prettyConsole.debug("Signal AI:", signalAI);
        prettyConsole.debug("KST trend:", trend.direction);
        console.groupEnd();

        // Calculate final signal
        if (trend.direction === "up" && signalAI === "up") {
          selectedWeights = WEIGHTS_UP;
        } else if (trend.direction === "down" || signalAI === "down") {
          selectedWeights = WEIGHTS_DOWN;
        }
        prettyConsole.info("Selected weights:", selectedWeights);
        await rebalancePortfolio(dexWallet, TOKENS, selectedWeights, USDC);
      } catch (error) {
        prettyConsole.error("Error during rebalancing:", error);
      }
    }, INTERVAL * 1000); // 1 minute = 60000 ms
  } catch (error) {
    prettyConsole.error("Error during initialization:", error);
  }
}

async function main() {
  await rebalancer();
}

main().catch((error) => {
  prettyConsole.error("An error occurred:", error);
});
