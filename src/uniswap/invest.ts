import { BigNumber, Contract } from "ethers";
import { DexWallet } from "../dexWallet";
import { swapCustom } from "./rebalance";
import { swap } from "./swap";
import erc20Abi from "./contracts/ERC20.json";
import { formatEther } from "ethers/lib/utils";
import { PrettyConsole } from "../utils/prettyConsole";

import { loadPrettyConsole } from "../utils/prettyConsole";
const prettyConsole = loadPrettyConsole();
export async function invest(
  dexWallet: DexWallet,
  allocations: { [token: string]: number },
  usdtAddress: string,
  desiredTokens: string[],
  sellAll: boolean,
  buyAmount?: Number
) {
  const tokenContract = new Contract(usdtAddress, erc20Abi, dexWallet.wallet);
  let usdBalance: BigNumber = await tokenContract.balanceOf(
    dexWallet.wallet.address
  );

  let totalAllocation = 0;
  for (const token of desiredTokens) {
    totalAllocation += allocations[token];
  }

  if (totalAllocation !== 10000) {
    // Assuming allocations are in basis points (10000 = 100%)
    throw new Error("Total allocation must sum up to 100%");
  }

  if (sellAll) {
    for (const token of desiredTokens) {
      const tokenContract = new Contract(token, erc20Abi, dexWallet.wallet);
      const tokenBalance: BigNumber = await tokenContract.balanceOf(
        dexWallet.wallet.address
      );
      prettyConsole.log("Balance for", token, "is", formatEther(tokenBalance));
      if (tokenBalance > BigNumber.from(0)) {
        prettyConsole.log("Selling", token);
        await swap(dexWallet, [token, usdtAddress], false);
        await new Promise((resolve) => setTimeout(resolve, 10000));
      } else {
        prettyConsole.log("No Balance for", token);
      }
    }
  }

  for (const token of desiredTokens) {
    if (buyAmount) {
      usdBalance = BigNumber.from(buyAmount).mul(1e6);
    }

    const allocationPercentage = BigNumber.from(allocations[token]);
    const tokenAmount = usdBalance.mul(allocationPercentage).div(10000);

    // Swap USDT for the current token based on its allocation
    if (!tokenAmount.isZero()) {
      await swapCustom(dexWallet, [token, usdtAddress], true, tokenAmount);
      await new Promise((resolve) => setTimeout(resolve, 10000));
    }
  }

  prettyConsole.log("Investment distributed according to allocations.");
}
