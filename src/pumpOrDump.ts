import { swap } from "./uniswap/swap";
import { initializeWallet } from "./dexWallet";
import { POLYGON } from "./networks";

const token1 = process.argv[2];
const token2 = process.argv[3];
const action = process.argv[4];

const main = async () => {
  const dexWallet = await initializeWallet(POLYGON[0]);
  await swap(dexWallet, [token1, token2], action == "pump" ? false : true);
};

main().then(() => {
  console.log("Async operation completed");
});
