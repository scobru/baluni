import YEARN_VAULT_ABI from "../../abis/yearn/YearnVault.json";
import ERC20ABI from "../../abis/common/ERC20.json";
import { BigNumber, ContractInterface, ethers } from "ethers";
import { DexWallet } from "../../utils/dexWallet";
import { approveToken } from "../../utils/approveToken";
import { loadPrettyConsole } from "../../utils/prettyConsole";
import { callContractMethod } from "../../utils/contractUtils";
import { waitForTx } from "../../utils/networkUtils";

const pc = loadPrettyConsole();

export async function depositToYearn(
  tokenAddr: string,
  pool: string,
  amount: BigNumber,
  dexWallet: DexWallet,
  config: any,
) {
  try {
    const provider = dexWallet.wallet.provider;
    const signer = dexWallet.wallet;
    const token = new ethers.Contract(tokenAddr, ERC20ABI, signer);
    const vault = new ethers.Contract(pool, YEARN_VAULT_ABI, signer);
    const tokenBalance = await token.balanceOf(dexWallet.wallet.address);
    const gasPrice = await provider.getGasPrice();

    if (tokenBalance.lt(amount)) {
      throw new Error("Insufficient balance");
    }

    await approveToken(token, amount, pool, gasPrice, dexWallet, config);
    pc.log("Deposit to yearn", amount.div(1e6), "USDC");

    const tx = await callContractMethod(
      vault,
      "deposit",
      [amount, dexWallet.walletAddress],
      dexWallet.walletProvider,
      gasPrice,
    );

    await waitForTx(provider, tx.hash);

    pc.success("Deposited to yearn", amount, "USDC");
  } catch (e) {
    console.log(e);
  }
}

export async function redeemFromYearn(pool: string, amount: BigNumber, dexWallet: DexWallet, config: any) {
  try {
    const provider = dexWallet.wallet.provider;
    const signer = dexWallet.wallet;
    const vault = new ethers.Contract(pool, YEARN_VAULT_ABI as ContractInterface, signer);
    const gasPrice = await provider.getGasPrice();
    const vaultBalance = await vault.balanceOf(dexWallet.wallet.address);

    if (vaultBalance.lt(amount)) {
      throw new Error("Insufficient balance");
    }

    await approveToken(vault, amount, pool, gasPrice, dexWallet, config);
    pc.log("Withdraw from yearn", amount.toString());

    const tx = await callContractMethod(
      vault,
      "redeem(uint256,address,address,uint256)",
      [amount, dexWallet.walletAddress, dexWallet.walletAddress, BigNumber.from(200)],
      dexWallet.walletProvider,
      gasPrice,
    );

    await waitForTx(provider, tx.hash);
  } catch (e) {
    console.log(e);
  }
}

export async function accuredYearnInterest(pool: string, dexWallet: DexWallet) {
  const signer = dexWallet.wallet;
  const vault = new ethers.Contract(pool, YEARN_VAULT_ABI, signer);
  const balanceVault = await vault.balanceOf(dexWallet.walletAddress);
  const balanceToken = await vault.previewWithdraw(balanceVault);
  const interest = BigNumber.from(balanceVault.sub(balanceToken));

  pc.log("🏦 Balance Vault for " + pool + ":", balanceVault.toString());
  pc.log("🪙  Balance Token for " + pool + ":", balanceToken.toString());
  pc.log("💶 Accured interest for " + pool + ":", Number(interest));
  pc.success("Accured interest Calculation DONE!");

  return interest;
}

export async function previewWithdraw(pool: string, dexWallet: DexWallet) {
  const signer = dexWallet.wallet;
  const vault = new ethers.Contract(pool, YEARN_VAULT_ABI, signer);
  const balanceVault = await vault.balanceOf(dexWallet.walletAddress);
  const balance = await vault.previewWithdraw(balanceVault);

  return balance;
}

export async function getVaultAsset(pool: string, dexWallet: DexWallet) {
  const signer = dexWallet.wallet;
  const vault = new ethers.Contract(pool, YEARN_VAULT_ABI, signer);
  const asset = await vault.asset();

  return asset;
}
