import { initializeWallet } from "./utils/dexWallet";
import { rebalancePortfolio } from "./uniswap/rebalance";
import { TOKENS, WEIGHTS_UP, WEIGHTS_DOWN, USDC, INTERVAL, SELECTED_CHAINID, EMA_SYMBOL } from "./config";
import { NETWORKS } from "./config";
import { PrettyConsole } from "./utils/prettyConsole";
import { welcomeMessage } from "./welcome";
import { calculateEMA } from "./ta/calculateEMA";
import {} from "./config";

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

  // Set the default weights
  let selectedWeights = WEIGHTS_UP;

  // TODO calculate EMA SCRIPT
  // calculateEMA
  const TREND = "";

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

main().catch(error => {
  prettyConsole.error("An error occurred:", error);
});
