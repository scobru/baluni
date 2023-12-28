// feeRecharge.ts
import { initializeWallet } from "../dexWallet";
import { WNATIVE, USDC, NATIVE } from "../config";
import { swapCustom } from "./rebalance";
import { BigNumber, ethers } from "ethers";
import wethAbi from "./contracts/WETH.json";
import { formatEther, parseEther } from "ethers/lib/utils";
import { POLYGON } from "../networks";
import { callContractMethod } from "../contractUtils";

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
    const USDCContract = new ethers.Contract(USDC, wethAbi, dexWallet.wallet);
    const balanceWNATIVEB4: BigNumber = await WNATIVEContract.balanceOf(
      dexWallet.wallet.address
    );

    const balanceNATIVEB4: BigNumber = await NATIVEContract.balanceOf(
      dexWallet.wallet.address
    );

    const balanceUSDCB4: BigNumber = await USDCContract.balanceOf(
      dexWallet.wallet.address
    );
    // wallet balance
    console.log("Balance WNATIVE: ", formatEther(balanceWNATIVEB4.toString()));
    console.log("Balance NATIVE:", formatEther(balanceNATIVEB4.toString()));

    if (
      Number(formatEther(balanceNATIVEB4.toString())) < 2 &&
      Number(formatEther(balanceWNATIVEB4.toString())) > 0
    ) {
      if (
        Number(formatEther(balanceWNATIVEB4.toString())) < 2 &&
        balanceUSDCB4.gt(BigNumber.from(2).mul(10).pow(6))
      ) {
        await swapCustom(
          dexWallet,
          [WNATIVE, USDC],
          true,
          BigNumber.from(2).mul(10).pow(6)
        );
      }

      const amountToWithdraw = parseEther("2");

      const gasPrice: BigNumber = dexWallet.providerGasPrice.mul(15).div(10);

      console.log("Withdrawing WNATIVE");
      const withrawalResult = await callContractMethod(
        WNATIVEContract,
        "withdraw",
        [amountToWithdraw],
        gasPrice
      );

      console.log("Withrawal result:", withrawalResult);

      // check balance after
      const balanceNATIVE: BigNumber = await NATIVEContract.balanceOf(
        dexWallet.wallet.address
      );
      console.log("Balance:", formatEther(balanceNATIVE.toString()));
    } else if (Number(formatEther(balanceNATIVEB4.toString())) > 3) {
      const amountToDeposit = balanceNATIVEB4.sub(parseEther("3"));
      console.log("Deposit WNATIVE");
      const gasPrice: BigNumber = dexWallet.providerGasPrice.mul(15).div(10);
      const depositResult = await callContractMethod(
        WNATIVEContract,
        "deposit",
        [{ value: amountToDeposit }],
        gasPrice
      );
      console.log("Deposit result:", depositResult);

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
