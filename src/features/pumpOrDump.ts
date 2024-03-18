import { swap } from "../scripts/uniswap/actions/swap";
import { initializeWallet } from "../utils/web3/dexWallet";
import { loadPrettyConsole } from "../utils/prettyConsole";
import { updateConfig } from "../config/updateConfig";
const prettyConsole = loadPrettyConsole();

const token0 = String(process.argv[2]);
const token1 = String(process.argv[3]);
const action = process.argv[4];
const protocol = String(process.argv[5]);
const chainId = process.argv[6];
const amount = process.argv[7];
const slippage = process.argv[8];

const main = async () => {
  const config = await updateConfig();
  const dexWallet = await initializeWallet(config?.NETWORKS as string);
  await swap(
    dexWallet,
    token0,
    token1,
    action == "pump" ? false : true,
    String(protocol),
    chainId,
    amount,
    Number(slippage),
  );
};

main().then(() => {
  prettyConsole.log("Async operation completed");
});
