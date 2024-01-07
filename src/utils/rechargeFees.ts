// feeRecharge.ts
import { initializeWallet } from "./dexWallet";
import { WNATIVE, USDC, NATIVE } from "../config";
import { swapCustom } from "../uniswap/rebalance";
import { BigNumber } from "ethers";
import { formatEther } from "ethers/lib/utils";
import { POLYGON } from "./networks";
import { unwrapETH } from "./wrapEth";
import { getTokenBalance } from "./getTokenBalance";

import { loadPrettyConsole } from "./prettyConsole";
import { waitForTx } from "./networkUtils";
const prettyConsole = loadPrettyConsole();

export async function rechargeFees() {
  try {
    const dexWallet = await initializeWallet(POLYGON[1]);

    const { balance: balanceNATIVEB4, formatted: balanceNATIVEB4Formatted } =
      await getTokenBalance(dexWallet, dexWallet.walletAddress, NATIVE);

    const { balance: balanceWNATIVEB4, formatted: balanceWNATIVEB4Formatted } =
      await getTokenBalance(dexWallet, dexWallet.walletAddress, WNATIVE);

    const { balance: balanceUSDCB4, formatted: balanceUSDCB4Formatted } =
      await getTokenBalance(dexWallet, dexWallet.walletAddress, USDC);

    prettyConsole.info(
      "BALANCE WNATIVE",
      formatEther(balanceWNATIVEB4.toString())
    );

    prettyConsole.info(
      "BALANCE NATIVE",
      formatEther(balanceNATIVEB4.toString())
    );

    if (Number(formatEther(balanceNATIVEB4.toString())) < 2) {
      if (balanceUSDCB4.gt(BigNumber.from(2).mul(10).pow(6))) {
        const tx = await swapCustom(
          dexWallet,
          [WNATIVE, USDC],
          true,
          BigNumber.from(2).mul(10).pow(6)
        );
        await waitForTx(dexWallet.wallet.provider, tx.hash);
      }

      prettyConsole.log("Withdrawing WNATIVE");
      await unwrapETH(dexWallet, "2");

      const { balance: balanceNATIVE, formatted: balanceNATIVEB4Formatted } =
        await getTokenBalance(dexWallet, dexWallet.walletAddress, NATIVE);

      prettyConsole.log("Balance:", balanceNATIVEB4Formatted);
    }
    prettyConsole.log("Fee recharge operation completed");
  } catch (error) {
    console.error("Error during fee recharge:", error);
  }
}
