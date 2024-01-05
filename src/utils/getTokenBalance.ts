// import chalk from "chalk";
import ERC20_ABI from "../uniswap/contracts/ERC20.json";
import { DexWallet } from "./dexWallet";
import { ethers } from "ethers";
import { PrettyConsole } from "./prettyConsole";

import { loadPrettyConsole } from "./prettyConsole";
const prettyConsole = loadPrettyConsole();

export async function getTokenBalance(
  dexWallet: DexWallet,
  accountAddress: string,
  tokenAddress: string
) {
  const provider = dexWallet.wallet.provider;
  const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
  const decimals = await tokenContract.decimals();
  const symbol = await tokenContract.symbol();
  const rawBalance = await tokenContract.balanceOf(accountAddress);
  const formattedBalance = ethers.utils.formatUnits(rawBalance, decimals);

  // prettier-ignore
  prettyConsole.success((`Address: ${accountAddress} has ${formattedBalance} ${symbol}`));

  return { balance: rawBalance, formatted: formattedBalance };
}
