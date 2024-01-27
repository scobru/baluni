import { initializeWallet } from "./utils/dexWallet";
import { rebalancePortfolio } from "./uniswap/rebalanceYearn";
import {
  TOKENS,
  WEIGHTS_UP,
  WEIGHTS_DOWN,
  USDC,
  INTERVAL,
  LINEAR_REGRESSION,
  TREND_FOLLOWING,
  SELECTED_CHAINID,
} from "./config";
import { NETWORKS } from "./config";
import { predict } from "./predict/predict";
import { PrettyConsole } from "./utils/prettyConsole";
import { welcomeMessage } from "./welcome";

const prettyConsole = new PrettyConsole();
prettyConsole.clear();
prettyConsole.closeByNewLine = true;
prettyConsole.useIcons = true;

async function rebalancer(chainId: number) {
  welcomeMessage();
  await executeRebalance(chainId);
  try {
    setInterval(async () => {
      try {
        await executeRebalance(chainId);
      } catch (error) {
        prettyConsole.error("Error during rebalancing:", error);
      }
    }, INTERVAL * 1000);
  } catch (error) {
    prettyConsole.error("Error during initialization:", error);
  }
}

async function executeRebalance(chainId: number) {
  // Log the initiation of portfolio checking
  prettyConsole.log("Checking portfolio");

  // Initialize the wallet with the first Polygon network node
  const dexWallet = await initializeWallet(NETWORKS[chainId]);

  // Set the default weight
  let selectedWeights = WEIGHTS_UP;

  // Import required modules and functions
  const { kstCross, getDetachSourceFromOHLCV } = require("trading-indicator");

  // Get input data from Binance for BTC/USDT pair with 1h interval
  const { input } = await getDetachSourceFromOHLCV(
    "binance",
    "BTC/USDT",
    "1h",
    false
  );

  // Calculate KST indicator results
  const kstResult = await kstCross(input, 10, 15, 20, 30, 10, 10, 10, 15, 9);
  prettyConsole.debug("KST:", await kstResult.direction, await kstResult.cross);

  // Initialize the signal for AI
  let signalAI = "none";

  // Assume a function predict() exists for linear regression predictions
  const linearRegression: any = await predict();

  // Determine the direction of the signal based on prediction results
  if (linearRegression.predicted > linearRegression.actual) {
    signalAI = "up";
  } else if (linearRegression.predicted < linearRegression.actual) {
    signalAI = "down";
  }

  // Log the AI signal and KST trend results
  prettyConsole.debug(
    "🤖 Signal AI:",
    signalAI,
    "📈 KST trend:",
    kstResult.direction,
    "❎ KST cross:",
    kstResult.cross
  );

  let TREND: Boolean = true;

  if (TREND_FOLLOWING && LINEAR_REGRESSION) {
    if (kstResult.direction === "up" && signalAI === "up" && kstResult.cross) {
      TREND = true;
    } else if (
      kstResult.direction === "down" &&
      signalAI === "down" &&
      kstResult.cross
    ) {
      TREND = false;
    }
  } else if (TREND_FOLLOWING && !LINEAR_REGRESSION) {
    if (kstResult.direction === "up" && kstResult.cross) {
      TREND = true;
    } else if (kstResult.direction === "down" && kstResult.cross) {
      TREND = false;
    }
  } else if (TREND_FOLLOWING && LINEAR_REGRESSION) {
    if (
      signalAI === "up" &&
      kstResult.cross === true &&
      kstResult.direction === "up"
    ) {
      TREND = true;
    } else if (
      signalAI === "down" &&
      kstResult.cross === true &&
      kstResult.direction === "down"
    ) {
      TREND = false;
    }
  } else if (!TREND_FOLLOWING && !LINEAR_REGRESSION) {
    TREND = true;
  } else if (TREND_FOLLOWING) {
    if (kstResult.direction === "none" && !kstResult.cross) {
      TREND = true;
    }
  }

  prettyConsole.debug("🔭 Trend:", TREND);

  // Logic to determine the new weights based on various conditions
  // It logs and changes weights based on KST and AI signals
  // The conditions for weight change are much more clearly laid out
  if (TREND) {
    selectedWeights = WEIGHTS_UP;
    prettyConsole.log("🦄 Selected weights:", JSON.stringify(selectedWeights));
    await rebalancePortfolio(dexWallet, TOKENS, selectedWeights, USDC[chainId]);
  } else if (!TREND) {
    selectedWeights = WEIGHTS_DOWN;
    prettyConsole.log("🦄 Selected weights:", JSON.stringify(selectedWeights));
    await rebalancePortfolio(dexWallet, TOKENS, selectedWeights, USDC[chainId]);
  }
}

async function main() {
  await rebalancer(SELECTED_CHAINID); //
}

main().catch((error) => {
  prettyConsole.error("An error occurred:", error);
});
