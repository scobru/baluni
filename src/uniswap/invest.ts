import { BigNumber, Contract, Signer } from "ethers";
import { DexWallet } from "../dexWallet";
import { swapUSDT } from "./rebalance";
import erc20Abi from "./contracts/ERC20.json";

export async function invest(
  dexWallet: DexWallet,
  allocations: { [token: string]: number },
  usdtAddress: string,
  desiredTokens: string[]
) {
  const tokenContract = new Contract(usdtAddress, erc20Abi, dexWallet.wallet);
  const tokenABalance: BigNumber = await tokenContract.balanceOf(
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

  for (const token of desiredTokens) {
    const allocationPercentage = BigNumber.from(allocations[token]);
    const tokenAmount = tokenABalance.mul(allocationPercentage).div(10000);

    // Swap USDT for the current token based on its allocation
    if (!tokenAmount.isZero()) {
      await swapUSDT(dexWallet, [usdtAddress, token], false, tokenAmount);
    }
  }

  console.log("Investment distributed according to allocations.");
}
