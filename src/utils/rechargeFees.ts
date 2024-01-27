// feeRecharge.ts
import { WNATIVE, NATIVE, YEARN_VAULTS } from "../config";
import { formatEther, parseEther } from "ethers/lib/utils";
import { unwrapETH } from "./wrapEth";
import { getTokenBalance } from "./getTokenBalance";
import { loadPrettyConsole } from "./prettyConsole";
import { redeemFromYearn } from "../yearn/interact";
import { DexWallet } from "./dexWallet";

const pc = loadPrettyConsole();

export async function rechargeFees(dexWallet: DexWallet) {
  try {
    const { balance: balanceNATIVEB4, formatted: balanceNATIVEB4Formatted } =
      await getTokenBalance(
        dexWallet.walletProvider,
        dexWallet.walletAddress,
        NATIVE[dexWallet.walletProvider.network.chainId]
      );

    const { balance: balanceWNATIVEB4, formatted: balanceWNATIVEB4Formatted } =
      await getTokenBalance(
        dexWallet.walletProvider,
        dexWallet.walletAddress,
        WNATIVE[dexWallet.walletProvider.network.chainId]
      );

    const balanceWMATIC_YEARN = await getTokenBalance(
      dexWallet.walletProvider,
      dexWallet.walletAddress,
      YEARN_VAULTS[dexWallet.walletProvider.network.chainId].WMATIC
    );

    pc.info("BALANCE WNATIVE", formatEther(balanceWNATIVEB4.toString()));
    pc.info("BALANCE NATIVE", formatEther(balanceNATIVEB4.toString()));

    if (Number(formatEther(balanceNATIVEB4.toString())) < 2) {
      if (
        Number(formatEther(balanceWNATIVEB4.toString())) < 2 &&
        2 < balanceWMATIC_YEARN.balance
      ) {
        await redeemFromYearn(
          YEARN_VAULTS[dexWallet.walletProvider.network.chainId].WMATIC,
          parseEther("2"),
          dexWallet
        );
      }

      pc.log("Withdrawing WNATIVE");
      await unwrapETH(dexWallet, "2");

      const balanceNative = await getTokenBalance(
        dexWallet.walletProvider,
        dexWallet.walletAddress,
        NATIVE[dexWallet.walletProvider.network.chainId]
      );

      pc.log("Balance:", balanceNative.formatted);
    }

    pc.log("Fee recharge operation completed");
  } catch (error) {
    console.error("Error during fee recharge:", error);
  }
}
