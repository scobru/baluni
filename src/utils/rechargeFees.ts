// feeRecharge.ts
import { initializeWallet } from "./dexWallet";
import { WNATIVE, NATIVE, YEARN_AAVE_V3_WMATIC } from "../config";
import { formatEther, parseEther } from "ethers/lib/utils";
import { POLYGON } from "../config";
import { unwrapETH } from "./wrapEth";
import { getTokenBalance } from "./getTokenBalance";
import { loadPrettyConsole } from "./prettyConsole";
import { redeemFromYearn } from "../yearn/interact";

const pc = loadPrettyConsole();

export async function rechargeFees() {
  try {
    const dexWallet = await initializeWallet(POLYGON[1]);

    const { balance: balanceNATIVEB4, formatted: balanceNATIVEB4Formatted } =
      await getTokenBalance(dexWallet, dexWallet.walletAddress, NATIVE);

    const { balance: balanceWNATIVEB4, formatted: balanceWNATIVEB4Formatted } =
      await getTokenBalance(dexWallet, dexWallet.walletAddress, WNATIVE);

    const balanceWMATIC_YEARN = await getTokenBalance(
      dexWallet,
      dexWallet.walletAddress,
      YEARN_AAVE_V3_WMATIC
    );

    pc.info("BALANCE WNATIVE", formatEther(balanceWNATIVEB4.toString()));

    pc.info("BALANCE NATIVE", formatEther(balanceNATIVEB4.toString()));

    if (Number(formatEther(balanceNATIVEB4.toString())) < 2) {
      if (
        Number(formatEther(balanceWNATIVEB4.toString())) < 2 &&
        2 < balanceWMATIC_YEARN.balance
      ) {
        await redeemFromYearn(YEARN_AAVE_V3_WMATIC, parseEther("2"), dexWallet);
      }

      pc.log("Withdrawing WNATIVE");
      await unwrapETH(dexWallet, "2");

      const balanceNative = await getTokenBalance(
        dexWallet,
        dexWallet.walletAddress,
        NATIVE
      );

      pc.log("Balance:", balanceNative.formatted);
    }

    pc.log("Fee recharge operation completed");
  } catch (error) {
    console.error("Error during fee recharge:", error);
  }
}
