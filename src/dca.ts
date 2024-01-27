import { initializeWallet } from "./utils/dexWallet";
import {
  TOKENS,
  INVESTMENT_AMOUNT,
  USDC,
  WEIGHTS_UP,
  INVESTMENT_INTERVAL,
  NETWORKS,
  SELECTED_CHAINID,
} from "./config";
import { invest } from "./uniswap/invest";
import { rechargeFees } from "./utils/rechargeFees";
import { loadPrettyConsole } from "./utils/prettyConsole";

const prettyConsole = loadPrettyConsole();

// DCA configuration
// the amount in USDC for each investment

async function dca(chainId: number) {
  try {
    const dexWallet = await initializeWallet(NETWORKS[chainId]);
    await rechargeFees(dexWallet);
    // Initialize your DexWallet here

    // DCA Mechanism - periodically invest
    const investDCA = async () => {
      try {
        await invest(
          dexWallet,
          WEIGHTS_UP,
          USDC[chainId],
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
  await dca(SELECTED_CHAINID);
  prettyConsole.log("DCA Rebalancer operation started");
}

main().catch((error) => {
  prettyConsole.error("An error occurred:", error);
});
