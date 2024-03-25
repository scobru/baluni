import { DexWallet, initializeWallet } from "../../utils/web3/dexWallet";
import { rebalancePortfolio } from "./execute";
import { predict } from "../../features/ml/predict";
import { PrettyConsole } from "../../utils/prettyConsole";
import { welcomeMessage } from "../../welcome";
import { NETWORKS, USDC } from "baluni-api";

import * as _config from "./config";

const prettyConsole = new PrettyConsole();

prettyConsole.clear();
prettyConsole.closeByNewLine = true;
prettyConsole.useIcons = true;

async function rebalancer() {
  welcomeMessage();
  await executeRebalance();
  try {
    setInterval(async () => {
      try {
        await executeRebalance(_config);
      } catch (error) {
        prettyConsole.error("Error during rebalancing:", error);
      }
    }, Number(_config?.INTERVAL) * 1000);
  } catch (error) {
    prettyConsole.error("Error during initialization:", error);
  }
}

export async function executeRebalance(config?: any, dexWallet?: DexWallet) {
  // Log the initiation of portfolio checking
  prettyConsole.log("Checking portfolio");

  const chainId = config?.SELECTED_CHAINID;

  if (!dexWallet) {
    dexWallet = await initializeWallet(NETWORKS[chainId]);
  }

  // Set the default weight
  let selectedWeights = config?.WEIGHTS_UP;

  // Import required modules and functions
  const { kstCross, getDetachSourceFromOHLCV } = require("trading-indicator");

  // Get input data from Binance for BTC/USDT pair with 1h interval
  const { input } = await getDetachSourceFromOHLCV("binance", "BTC/USDT", "1h", false);

  // Calculate KST indicator results
  const kstResult = await kstCross(input, 10, 15, 20, 30, 10, 10, 10, 15, 9);
  prettyConsole.debug("KST:", await kstResult.direction, await kstResult.cross);

  // Initialize the signal for AI
  let signalAI = "none";

  // Assume a function predict() exists for linear regression predictions
  const prediction: any = await predict(
    config?.PREDICTION_ALGO,
    config?.PREDICTION_SYMBOL,
    config?.PREDICTION_PERIOD,
    config?.PREDICTION_EPOCHS,
  );

  // Determine the direction of the signal based on prediction results
  if (prediction.predicted > prediction.actual) {
    signalAI = "up";
  } else if (prediction.predicted < prediction.actual) {
    signalAI = "down";
  }

  // Log the AI signal and KST trend results
  prettyConsole.debug(
    "🤖 Signal AI:",
    signalAI,
    "📈 KST trend:",
    kstResult.direction,
    "❎ KST cross:",
    kstResult.cross,
  );

  let TREND: Boolean = true;
  let LAST_TREND: Boolean = true;

  if (config?.TREND_FOLLOWING && signalAI !== "none") {
    if (kstResult.direction === "up" && signalAI === "up" && kstResult.cross) {
      TREND = true;
      LAST_TREND = true;
    } else if (kstResult.direction === "down" && signalAI === "down" && kstResult.cross) {
      TREND = false;
      LAST_TREND = false;
    } else if (kstResult.direction === "none" && !kstResult.cross) {
      TREND = LAST_TREND;
    }
  } else if (config?.TREND_FOLLOWING && signalAI == "none") {
    if (kstResult.direction === "up" && kstResult.cross) {
      TREND = true;
      LAST_TREND = true;
    } else if (kstResult.direction === "down" && kstResult.cross) {
      TREND = false;
      LAST_TREND = false;
    } else if (kstResult.direction === "none" && !kstResult.cross) {
      TREND = LAST_TREND;
    }
  } else if (!config?.TREND_FOLLOWING && signalAI == "none") {
    TREND = true;
    LAST_TREND = true;
  }

  prettyConsole.debug("🔭 Trend:", TREND);

  // Logic to determine the new weights based on various conditions
  // It logs and changes weights based on KST and AI signals
  // The conditions for weight change are much more clearly laid out
  if (TREND) {
    selectedWeights = config?.WEIGHTS_UP;
    prettyConsole.log("🦄 Selected weights:", JSON.stringify(selectedWeights));
    await rebalancePortfolio(dexWallet, config?.TOKENS, selectedWeights, USDC);
  } else if (!TREND) {
    selectedWeights = config?.WEIGHTS_DOWN;
    prettyConsole.log("🦄 Selected weights:", JSON.stringify(selectedWeights));
    await rebalancePortfolio(dexWallet, config?.TOKENS, selectedWeights, USDC);
  }
}

async function main() {
  await rebalancer();
}

main().catch(error => {
  prettyConsole.error("An error occurred:", error);
});
