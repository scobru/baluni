import { initializeWallet } from "./dexWallet";
import { promisify } from "util";
import { updateConfig } from "../../config/updateConfig";

const txHash = process.argv[2];

const main = promisify(async () => {
  const config = await updateConfig();
  const dexWallet = await initializeWallet(config?.NETWORKS as string);
  const { wallet } = dexWallet;
  const txReceipt = await wallet.provider.getTransactionReceipt(txHash);
  console.log("TX RECEIPT", txReceipt);
});

main().then(() => {
  console.log("Async operation completed");
});
