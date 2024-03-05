import { initializeWallet } from "../utils/dexWallet"; // Import the initializeWallet function
import { invest } from "../scripts/uniswap/invest";
import { rechargeFees } from "../utils/rechargeFees";
import { loadPrettyConsole } from "../utils/prettyConsole";
import { updateConfig } from "../config/updateConfig";

const prettyConsole = loadPrettyConsole();

const sellAll = Boolean(process.argv[3]);

async function investor() {
  const config = await updateConfig();

  prettyConsole.log("Sell All?", sellAll);
  try {
    const dexWallet = await initializeWallet(String(config?.NETWORKS));
    await rechargeFees(dexWallet, config);
    // Initialize your DexWallet here
    await invest(dexWallet, config?.WEIGHTS_UP as any, String(config?.USDC), config?.TOKENS as any, sellAll);
    prettyConsole.log("Investing operation completed");
  } catch (error) {
    prettyConsole.error("Error during initialization:", error);
  }
}

async function main() {
  await investor();
  prettyConsole.log("Rebalancer operation started");
}

main().catch(error => {
  prettyConsole.error("An error occurred:", error);
});
