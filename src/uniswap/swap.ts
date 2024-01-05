import { BigNumber, Contract, ethers } from "ethers";
import { DexWallet } from "../utils/dexWallet";
import { callContractMethod } from "../utils/contractUtils";
import { waitForTx } from "../utils/networkUtils";
import erc20Abi from "./contracts/ERC20.json";
import swapRouterAbi from "./contracts/SwapRouter.json";
import { QUOTER, ROUTER, SLIPPAGE } from "../config";
import { PrettyConsole } from "../utils/prettyConsole";
import quoterAbi from "./contracts/Quoter.json";
import { formatEther, parseEther } from "ethers/lib/utils";

import { loadPrettyConsole } from "../utils/prettyConsole";
const prettyConsole = loadPrettyConsole();

export async function swap(
  dexWallet: DexWallet,
  pair: [string, string],
  reverse?: boolean
) {
  const { wallet, walletAddress, walletBalance, providerGasPrice } = dexWallet;

  prettyConsole.log(walletAddress + ":", walletBalance.toBigInt());

  const tokenAAddress = reverse ? pair[1] : pair[0];
  const tokenBAddress = reverse ? pair[0] : pair[1];
  const tokenAContract = new Contract(tokenAAddress, erc20Abi, wallet);
  const tokenBContract = new Contract(tokenBAddress, erc20Abi, wallet);

  const tokenABalance: BigNumber = await tokenAContract.balanceOf(
    walletAddress
  );

  const tokenBBalance: BigNumber = await tokenBContract.balanceOf(
    walletAddress
  );

  const tokenAName = await tokenAContract.symbol();
  const tokenBName = await tokenBContract.symbol();

  prettyConsole.log(
    "Token A",
    tokenABalance.toBigInt(),
    "Token B:",
    tokenBBalance.toBigInt()
  );

  const swapRouterAddress = ROUTER; // polygon
  const swapRouterContract = new Contract(
    swapRouterAddress,
    swapRouterAbi,
    wallet
  );

  prettyConsole.log("Provider gas price:", providerGasPrice.toBigInt());
  const gasPrice: BigNumber = providerGasPrice.mul(12).div(10);
  prettyConsole.log("  Actual gas price:", gasPrice.toBigInt());

  const allowance: BigNumber = await tokenAContract.allowance(
    walletAddress,
    swapRouterAddress
  );
  prettyConsole.log("Token A spenditure allowance:", allowance.toBigInt());

  if (allowance.lt(tokenABalance)) {
    const approvalResult = await callContractMethod(
      tokenAContract,
      "approve",
      [swapRouterAddress, tokenABalance],
      gasPrice
    );
    const broadcasted = await waitForTx(wallet.provider, approvalResult.hash);
    if (!broadcasted) {
      throw new Error(`TX broadcast timeout for ${approvalResult.hash}`);
    } else {
      prettyConsole.success(
        `Spending of ${tokenABalance.toBigInt()} approved.`
      );
    }
  }

  prettyConsole.log(`Swap ${tokenAName} for ${tokenBName}`);

  const swapDeadline = Math.floor(Date.now() / 1000 + 60 * 60);
  const slippageTolerance = SLIPPAGE;

  const quoterContract = new Contract(QUOTER, quoterAbi, wallet);
  const expectedAmountB = await quoterContract.callStatic.quoteExactInputSingle(
    tokenAAddress,
    tokenBAddress,
    3000,
    tokenABalance.toString(),
    0
  );

  prettyConsole.log(
    "Amount A: ",
    formatEther(tokenABalance),
    "Expected amount B:",
    formatEther(expectedAmountB.toString())
  );

  const minimumAmountB = expectedAmountB
    .mul(10000 - slippageTolerance)
    .div(10000);
  const swapTxInputs = [
    tokenAAddress,
    tokenBAddress,
    BigNumber.from(3000),
    walletAddress,
    BigNumber.from(swapDeadline),
    tokenABalance,
    minimumAmountB, // BigNumber.from(0),
    BigNumber.from(0),
  ];

  const swapTxResponse = await callContractMethod(
    swapRouterContract,
    "exactInputSingle",
    [swapTxInputs],
    gasPrice
  );

  return swapTxResponse;
}
