import { Contract, BigNumber, ethers } from "ethers";
import { callContractMethod } from "./contractUtils";
import { DexWallet } from "./dexWallet";
import { waitForTx } from "./networkUtils";
import { loadPrettyConsole } from "./prettyConsole";
import { MAX_APPROVAL } from "../config";

const prettyConsole = loadPrettyConsole();

export async function approveToken(
  tokenContract: Contract,
  swapAmount: BigNumber,
  to: string,
  gasPrice: BigNumber,
  dexWallet: DexWallet
) {
  let allowance: BigNumber = await tokenContract.allowance(
    dexWallet.walletAddress,
    to
  );

  if (allowance.lt(swapAmount)) {
    prettyConsole.log(
      "Approving spending of",
      swapAmount.toString(),
      "tokens" + " to " + to + "... "
    );

    const approveAmount = MAX_APPROVAL
      ? ethers.constants.MaxUint256
      : swapAmount;

    const approvalResult = await callContractMethod(
      tokenContract,
      "approve",
      [to, approveAmount],
      gasPrice
    );

    const broadcasted = await waitForTx(
      dexWallet.wallet.provider,
      approvalResult.hash
    );

    if (!broadcasted) {
      throw new Error(`TX broadcast timeout for ${approvalResult.hash}`);
    } else {
      prettyConsole.success(`Spending of ${swapAmount.toString()} approved.`);
    }
  } else {
    prettyConsole.success("No need to approve");
  }
}
