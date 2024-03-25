import { ethers } from "ethers";
import { loadPrettyConsole } from "../prettyConsole";

const pc = loadPrettyConsole();
const MAX_ATTEMPTS = 50;
const POLLING_INTERVAL = 5000;

export async function waitForTx(provider: ethers.providers.Provider, hash: string, sender: string): Promise<boolean> {
  pc.log(`Waiting for TX ${hash} to be broadcasted`);

  let txReceipt: ethers.providers.TransactionReceipt | null = null;
  let attempts = 0;
  let lastNonce = await provider.getTransactionCount(sender, "latest");

  while (!txReceipt && attempts < MAX_ATTEMPTS) {
    try {
      txReceipt = await provider.getTransactionReceipt(hash);
      let currentNonce = await provider.getTransactionCount(sender, "latest");

      console.log(
        `🕛 Waiting for TX ${hash} to be broadcasted. Attempts: ${attempts}/${MAX_ATTEMPTS} - Nonce: ${currentNonce} - Last Nonce: ${lastNonce} - Receipt: ${txReceipt}`,
      );

      if (currentNonce > lastNonce && !txReceipt) {
        pc.error(`TX ${hash} dropped`);
        return false;
      }

      lastNonce = currentNonce;
    } catch (error) {
      console.error(`Error getting transaction receipt: ${error}`);
    }

    if (!txReceipt) {
      await new Promise(resolve => setTimeout(resolve, POLLING_INTERVAL));
      attempts++;
    }
  }

  if (txReceipt) {
    console.log(`✔️ TX ${hash} broadcasted`);
    return true;
  } else {
    console.error(`TX ${hash} not broadcasted after ${MAX_ATTEMPTS} attempts`);
    return false;
  }
}
