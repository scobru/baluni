import { initializeWallet } from "./dexWallet";
import { promisify } from "util";
import { NETWORKS } from "../config";

const txHash = process.argv[2];

const main = promisify(async (chainId: number, config: any) => {
  const dexWallet = await initializeWallet(config?.NETWORK);
  const { wallet } = dexWallet;
  const txReceipt = await wallet.provider.getTransactionReceipt(txHash);
  console.log("TX RECEIPT", txReceipt);
});

main(137).then(() => {
  console.log("Async operation completed");
});
