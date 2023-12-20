import { BigNumber, Contract } from "ethers";
import { DexWallet } from "../dexWallet";
import { callContractMethod } from "../contractUtils";
import { waitForTx } from "../networkUtils";
import erc20Abi from "./contracts/ERC20.json";
import swapRouterAbi from "./contracts/SwapRouter.json";
import { quotePair } from "./quote";

export async function swapUSDT(
  dexWallet: DexWallet,
  pair: [string, string],
  reverse?: boolean,
  swapAmount?: BigNumber
) {
  const { wallet, walletAddress, walletBalance, providerGasPrice } = dexWallet;

  console.log(walletAddress + ":", walletBalance.toBigInt());

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

  console.log(
    "Token A",
    tokenABalance.toBigInt(),
    "Token B:",
    tokenBBalance.toBigInt()
  );

  const swapRouterAddress = "0xE592427A0AEce92De3Edee1F18E0157C05861564";
  const swapRouterContract = new Contract(
    swapRouterAddress,
    swapRouterAbi,
    wallet
  );

  console.log("Provider gas price:", providerGasPrice.toBigInt());
  const gasPrice: BigNumber = providerGasPrice.mul(12).div(10);
  console.log("  Actual gas price:", gasPrice.toBigInt());

  const allowance: BigNumber = await tokenAContract.allowance(
    walletAddress,
    swapRouterAddress
  );
  console.log("Token A spenditure allowance:", allowance.toBigInt());

  if (allowance.lt(swapAmount!)) {
    const approvalResult = await callContractMethod(
      tokenAContract,
      "approve",
      [swapRouterAddress, swapAmount],
      gasPrice
    );
    const broadcasted = await waitForTx(wallet.provider, approvalResult.hash);
    if (!broadcasted) {
      throw new Error(`TX broadcast timeout for ${approvalResult.hash}`);
    } else {
      console.log(`Spending of ${swapAmount?.toString()} approved.`);
    }
  }

  const swapDeadline = Math.floor(Date.now() / 1000 + 60 * 60);
  const swapTxInputs = [
    tokenAAddress,
    tokenBAddress,
    BigNumber.from(3000),
    walletAddress,
    BigNumber.from(swapDeadline),
    swapAmount,
    BigNumber.from(0),
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

export async function rebalancePortfolio(
  dexWallet: DexWallet,
  desiredTokens: string[],
  desiredAllocations: { [token: string]: number },
  usdtAddress: string
) {
  let totalPortfolioValue = BigNumber.from(0);
  let tokenValues: { [token: string]: BigNumber } = {};

  // Calcolo dei valori correnti di ogni token nel portafoglio
  for (const token of desiredTokens) {
    if (token !== usdtAddress) {
      const tokenContract = new Contract(token, erc20Abi, dexWallet.wallet);
      const tokenBalance = await tokenContract.balanceOf(
        dexWallet.walletAddress
      );
      const tokenPriceInUSDT = await quotePair(token, usdtAddress);
      const tokenValue = tokenBalance.mul(BigNumber.from(tokenPriceInUSDT));
      tokenValues[token] = tokenValue;
      totalPortfolioValue = totalPortfolioValue.add(tokenValue);
    } else {
      // Se il token è USDT, il suo valore in USDT è semplicemente la sua quantità
      const tokenContract = new Contract(token, erc20Abi, dexWallet.wallet);
      const tokenBalance = await tokenContract.balanceOf(
        dexWallet.walletAddress
      );
      tokenValues[token] = tokenBalance;
      totalPortfolioValue = totalPortfolioValue.add(tokenBalance);
    }
  }

  // Calcolo degli scambi necessari per il rebilanciamento
  for (const token of desiredTokens) {
    const currentAllocation = tokenValues[token]
      .mul(10000)
      .div(totalPortfolioValue);
    const desiredAllocation = BigNumber.from(desiredAllocations[token]);
    const difference = desiredAllocation.sub(currentAllocation);

    if (difference.abs().gt(BigNumber.from(100)) && token !== usdtAddress) {
      // Soglia per attivare il rebilanciamento (es. 1%)
      // Determinare l'importo da scambiare
      const amountToRebalance = totalPortfolioValue.mul(difference).div(10000);

      // Implementazione della logica di scambio
      if (difference.lt(0)) {
        // Vendi il token in eccesso
        await swapUSDT(
          dexWallet,
          [token, usdtAddress],
          true,
          amountToRebalance
        );
      } else {
        // Acquista il token sottorappresentato
        await swapUSDT(
          dexWallet,
          [usdtAddress, token],
          false,
          amountToRebalance
        );
      }
    }
  }

  console.log("Rebalance completato.");
}
