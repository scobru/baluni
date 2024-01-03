import { initializeWallet } from "./dexWallet";
import {
  TOKENS,
  INVESTMENT_AMOUNT,
  USDC,
  WEIGHTS_UP,
  INVESTMENT_INTERVAL,
} from "./config";
import { invest } from "./uniswap/invest";
import { POLYGON } from "./networks";
import { rechargeFees } from "./uniswap/rechargeFees";
import { PrettyConsole } from "./utils/prettyConsole";

import { loadPrettyConsole } from "../utils/prettyConsole";
const prettyConsole = loadPrettyConsole();

// DCA configuration
// the amount in USDC for each investment

async function dca() {
  try {
    await rechargeFees();
    // Initialize your DexWallet here
    const dexWallet = await initializeWallet(POLYGON[1]);

    // DCA Mechanism - periodically invest
    const investDCA = async () => {
      try {
        await invest(
          dexWallet,
          WEIGHTS_UP,
          USDC,
          TOKENS,
          false,
          INVESTMENT_AMOUNT
        );
        prettyConsole.log("Invested part of funds, continuing DCA");
      } catch (error) {
        prettyConsole.error("Error during DCA investment:", error);
      }
    };

    // Initial investment
    await investDCA();

    // Schedule further investments
    setInterval(async () => {
      await investDCA();
    }, INVESTMENT_INTERVAL);
  } catch (error) {
    prettyConsole.error("Error during initialization:", error);
  }
}

async function main() {
  await dca();
  prettyConsole.log("DCA Rebalancer operation started");
}

main().catch((error) => {
  prettyConsole.error("An error occurred:", error);
});
