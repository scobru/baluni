// feeRecharge.ts
import { initializeWallet } from "../dexWallet";
import { WNATIVE, USDC, NATIVE } from "../config";
import { swapCustom } from "./rebalance";
import { BigNumber, ethers } from "ethers";
import wethAbi from "./contracts/WETH.json";
import { formatEther, parseEther } from "ethers/lib/utils";
import { POLYGON } from "../networks";

export async function rechargeFees() {
  try {
    const dexWallet = await initializeWallet(POLYGON[1]);

    const WNATIVEContract = new ethers.Contract(
      WNATIVE,
      wethAbi,
      dexWallet.wallet
    );
    const NATIVEContract = new ethers.Contract(
      NATIVE,
      wethAbi,
      dexWallet.wallet
    );
    const balanceWNATIVEB4: BigNumber = await WNATIVEContract.balanceOf(
      dexWallet.wallet.address
    );

    let balanceNATIVEB4: BigNumber = await NATIVEContract.balanceOf(
      dexWallet.wallet.address
    );

    // wallet balance
    console.log("Balance WNATIVE: ", formatEther(balanceWNATIVEB4.toString()));
    console.log("Balance NATIVE:", formatEther(balanceNATIVEB4.toString()));

    if (balanceNATIVEB4 < parseEther("2")) {
      console.log("Swapping USDC for NATIVE");
      await swapCustom(
        dexWallet,
        [WNATIVE, USDC],
        true,
        BigNumber.from(2).mul(BigNumber.from(10).pow(6))
      );

      const balanceWNATIVEAfter: BigNumber = await WNATIVEContract.balanceOf(
        dexWallet.wallet.address
      );
      const amountToWithdraw = balanceWNATIVEAfter.sub(balanceWNATIVEB4);

      console.log("Withdrawing WNATIVE");
      await WNATIVEContract.withdraw(amountToWithdraw);

      // check balance after
      const balanceNATIVE: BigNumber = await NATIVEContract.balanceOf(
        dexWallet.wallet.address
      );
      console.log("Balance:", formatEther(balanceNATIVE.toString()));
    }

    console.log("Fee recharge operation completed");
  } catch (error) {
    console.error("Error during fee recharge:", error);
  }
}
