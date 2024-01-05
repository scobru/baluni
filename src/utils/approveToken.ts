import { Contract, BigNumber } from "ethers";
import { callContractMethod } from "./contractUtils";
import { DexWallet } from "./dexWallet";
import { waitForTx } from "./networkUtils";
import { loadPrettyConsole } from "./prettyConsole";

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
    const approvalResult = await callContractMethod(
      tokenContract,
      "approve",
      [to, swapAmount],
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
  }
}
