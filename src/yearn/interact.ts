import YEARN_VAULT_ABI from "./contracts/YEARN_VAULT.json";
import ERC20ABI from "./contracts/ERC20.json";
import { BigNumber, ContractInterface, ethers } from "ethers";
import { YEARN_AAVE_V3_USDC, USDC } from "../config";
import { DexWallet } from "../utils/dexWallet";
import { approveToken } from "../utils/approveToken";
import { loadPrettyConsole } from "../utils/prettyConsole";
import { callContractMethod } from "../utils/contractUtils";
import { waitForTx } from "../utils/networkUtils";
import { formatEther } from "ethers/lib/utils";

const prettyConsole = loadPrettyConsole();

export async function depositToYearn(amount: BigNumber, dexWallet: DexWallet) {
  try {
    const provider = dexWallet.wallet.provider;
    const signer = dexWallet.wallet;
    const token = new ethers.Contract(USDC, ERC20ABI, signer);

    const vault = new ethers.Contract(
      YEARN_AAVE_V3_USDC,
      YEARN_VAULT_ABI,
      signer
    );

    const tokenBalance = await token.balanceOf(dexWallet.wallet.address);
    if (tokenBalance.lt(amount)) {
      throw new Error("Insufficient balance");
    }

    const gasPrice = await provider.getGasPrice();

    await approveToken(token, amount, YEARN_AAVE_V3_USDC, gasPrice, dexWallet);
    prettyConsole.log("Deposit to yearn", amount.div(1e6), "USDC");

    const tx = await callContractMethod(
      vault,
      "deposit",
      [amount, dexWallet.walletAddress],
      gasPrice
    );

    await waitForTx(provider, tx.hash);

    prettyConsole.success("Deposited to yearn", amount, "USDC");
  } catch (e) {
    console.log(e);
  }
}

export async function redeemFromYearn(amount: BigNumber, dexWallet: DexWallet) {
  try {
    const provider = dexWallet.wallet.provider;
    const signer = dexWallet.wallet;

    const vault = new ethers.Contract(
      YEARN_AAVE_V3_USDC,
      YEARN_VAULT_ABI as ContractInterface,
      signer
    );

    const gasPrice = await provider.getGasPrice();
    const vaultBalance = await vault.balanceOf(dexWallet.wallet.address);

    if (vaultBalance.lt(amount)) {
      throw new Error("Insufficient balance");
    }

    await approveToken(vault, amount, YEARN_AAVE_V3_USDC, gasPrice, dexWallet);

    prettyConsole.log(
      "Withdraw from yearn",
      amount.div(1e6).toString(),
      "USDC"
    );

    const tx = await callContractMethod(
      vault,
      "redeem(uint256,address,address,uint256)",
      [
        amount,
        dexWallet.walletAddress,
        dexWallet.walletAddress,
        BigNumber.from(200),
      ],
      gasPrice
    );

    await waitForTx(provider, tx.hash);

    //await waitForTx(provider, tx.hash);
    prettyConsole.success("Withdrawn from yearn", amount, "USDC");
  } catch (e) {
    console.log(e);
  }
}

export async function accuredYearnInterest(dexWallet: DexWallet) {
  const signer = dexWallet.wallet;

  const vault = new ethers.Contract(
    YEARN_AAVE_V3_USDC,
    YEARN_VAULT_ABI,
    signer
  );

  const balanceVault = await vault.balanceOf(dexWallet.walletAddress);
  prettyConsole.log("Balance in vault", balanceVault.toString());

  const balanceUSDT = await vault.previewWithdraw(balanceVault);

  prettyConsole.log("Balance in USDT", balanceUSDT.toString());
  const interest = BigNumber.from(balanceVault - balanceUSDT);

  prettyConsole.log("Accured interest", Number(interest), "USDC");
  prettyConsole.success("Accured interest Calculation DONE!");

  return interest;
}

export async function previewWithdraw(dexWallet: DexWallet) {
  const signer = dexWallet.wallet;

  const vault = new ethers.Contract(
    YEARN_AAVE_V3_USDC,
    YEARN_VAULT_ABI,
    signer
  );

  const balanceVault = await vault.balanceOf(dexWallet.walletAddress);

  const balanceUSDT = await vault.previewWithdraw(balanceVault);

  return balanceUSDT;
}
