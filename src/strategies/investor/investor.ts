import { initializeWallet } from "../../utils/web3/dexWallet"; // Import the initializeWallet function
import { invest } from "./execute";
import { loadPrettyConsole } from "../../utils/prettyConsole";
import { updateConfig } from "../../config/updateConfig";

const prettyConsole = loadPrettyConsole();

const amount = String(process.argv[3]);
const sellAll = Boolean(process.argv[4]);

async function investor() {
  const config = await updateConfig();

  prettyConsole.log("Sell All?", sellAll);
  try {
    const dexWallet = await initializeWallet(String(config?.NETWORKS));

    await invest(
      dexWallet,
      config?.WEIGHTS_UP as any,
      String(config?.USDC),
      config?.TOKENS as any,
      sellAll,
      amount,
      config?.SELECTED_PROTOCOL,
      config?.SELECTED_CHAINID,
      Number(config?.SLIPPAGE),
    );
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
