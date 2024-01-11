import { swap } from "./uniswap/swap";
import { initializeWallet } from "./utils/dexWallet";
import { POLYGON } from "./config";

async function main() {
  const dexWallet = await initializeWallet(POLYGON[0]);
  await swap(
    dexWallet,
    [
      "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174", // USDC
      "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619", // WETH
    ],
    true
  );
}

main()
  .then(() => {
    console.log("Async operation completed");
  })
  .catch((error) => {
    console.error("An error occurred:", error);
  });
