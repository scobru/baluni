import { BigNumber, Contract } from "ethers";
import { quotePair } from "./uniswap/quote";
import erc20Abi from "./uniswap/contracts/ERC20.json";
import { DexWallet } from "./dexWallet";

export async function changeAllocation(
  dexWallet: DexWallet,
  desiredTokens: string[],
  desiredAllocations: { [token: string]: number },
  usdtAddress: string
) {
  // Calcola le allocazioni attuali
  const currentAllocations: { [token: string]: number } = {};

  for (const token of desiredTokens) {
    currentAllocations[token] = 0;
  }

  let totalPortfolioValue = BigNumber.from(0);
  let tokenValues: { [token: string]: BigNumber } = {};

  // Calcola i valori correnti di ogni token nel portafoglio
  for (const token of desiredTokens) {
    const tokenContract = new Contract(token, erc20Abi, dexWallet.wallet);
    const tokenBalance = await tokenContract.balanceOf(dexWallet.walletAddress);
    const tokenPriceInUSDT = await quotePair(token, usdtAddress);
    const tokenValue = tokenBalance.mul(BigNumber.from(tokenPriceInUSDT));
    tokenValues[token] = tokenValue;
    totalPortfolioValue = totalPortfolioValue.add(tokenValue);
  }

  // Calcola le allocazioni attuali
  for (const token of desiredTokens) {
    if (desiredAllocations[token]) {
      currentAllocations[token] =
        tokenValues[token].mul(10000).div(totalPortfolioValue).toNumber() / 100;
    }
  }

  // Gestisci il caso 1: Vendita dei token che non fanno parte della nuova allocazione
  for (const token of desiredTokens) {
    if (!desiredAllocations[token] && currentAllocations[token] > 0) {
      // Vendita del token
      await swapUSDT(dexWallet, [token, usdtAddress], true, tokenValues[token]);
    }
  }

  // Calcola le differenze nelle allocazioni
  const allocationDifferences: { [token: string]: number } = {};

  for (const token of desiredTokens) {
    if (desiredAllocations[token]) {
      allocationDifferences[token] =
        desiredAllocations[token] - currentAllocations[token];
    }
  }

  // Calcola il totale delle allocazioni desiderate
  let totalDesiredAllocation = 0;

  for (const token of desiredTokens) {
    if (desiredAllocations[token]) {
      totalDesiredAllocation += desiredAllocations[token];
    }
  }

  // Calcola il totale delle allocazioni attuali
  let totalCurrentAllocation = 0;

  for (const token of desiredTokens) {
    if (desiredAllocations[token]) {
      totalCurrentAllocation += currentAllocations[token];
    }
  }

  // Calcola la differenza totale
  const totalDifference = totalDesiredAllocation - totalCurrentAllocation;

  // Effettua il rebalancing (caso 2)
  if (totalDifference !== 0) {
    for (const token of desiredTokens) {
      if (desiredAllocations[token]) {
        const amountToRebalance = totalPortfolioValue
          .mul(allocationDifferences[token])
          .div(totalDifference);

        // Implementa la logica di scambio
        if (amountToRebalance.gt(BigNumber.from(0))) {
          if (allocationDifferences[token] < 0) {
            // Vendita del token in eccesso
            await swapUSDT(
              dexWallet,
              [token, usdtAddress],
              true,
              amountToRebalance
            );
          } else {
            // Acquisto del token sottorappresentato
            await swapUSDT(
              dexWallet,
              [usdtAddress, token],
              false,
              amountToRebalance
            );
          }
        }
      }
    }
  }

  console.log("Cambio delle allocazioni completato.");
}
