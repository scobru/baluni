// feeRecharge.ts
import { formatEther, parseEther } from "ethers/lib/utils";
import { unwrapETH } from "./wrapEth";
import { getTokenBalance } from "./getTokenBalance";
import { loadPrettyConsole } from "./prettyConsole";
import { redeemFromYearn } from "../protocols/yearn/interact";
import { DexWallet } from "./dexWallet";

const pc = loadPrettyConsole();

export async function rechargeFees(dexWallet: DexWallet, config: any) {
  try {
    console.log("NATIVE", config?.NATIVE);
    console.log("WRAPPED", config?.WRAPPED);

    const { balance: balanceNATIVEB4, formatted: balanceNATIVEB4Formatted } = await getTokenBalance(
      dexWallet.walletProvider,
      dexWallet.walletAddress,
      config?.NATIVE,
    );

    const { balance: balanceWNATIVEB4, formatted: balanceWNATIVEB4Formatted } = await getTokenBalance(
      dexWallet.walletProvider,
      dexWallet.walletAddress,
      config?.WRAPPED,
    );

    console.log("YEARN_VAULTS.WMATIC", config?.YEARN_VAULTS);

    const balanceWMATIC_YEARN = await getTokenBalance(
      dexWallet.walletProvider,
      dexWallet.walletAddress,
      config?.YEARN_VAULTS?.WMATIC,
    );

    pc.info("BALANCE WNATIVE", formatEther(balanceWNATIVEB4.toString()));
    pc.info("BALANCE NATIVE", formatEther(balanceNATIVEB4.toString()));

    if (Number(formatEther(balanceNATIVEB4.toString())) < 2) {
      if (Number(formatEther(balanceWNATIVEB4.toString())) < 2 && 2 < balanceWMATIC_YEARN.balance) {
        await redeemFromYearn(config?.YEARN_VAULTS.WMATIC, parseEther("2"), dexWallet, config);
      }

      pc.log("Withdrawing WNATIVE");
      await unwrapETH(dexWallet, "2", config);

      const balanceNative = await getTokenBalance(dexWallet.walletProvider, dexWallet.walletAddress, config?.NATIVE);

      pc.log("Balance:", balanceNative.formatted);
    }

    pc.log("Fee recharge operation completed");
  } catch (error) {
    console.error("Error during fee recharge:", error);
  }
}
