import ERC20_ABI from "../uniswap/contracts/ERC20.json";
import { Token } from "@uniswap/sdk-core";
import { DexWallet } from "./dexWallet";
import { ethers } from "ethers";

/** Creates Token object for use with uniswap sdk
 *
 * @param tokenAddress the token address
 * @returns Token object as defined by uniswap sdk
 */

export async function getTokenMetadata(
  tokenAddress: string,
  dexWallet: DexWallet
) {
  const provider = dexWallet.wallet.provider;

  const chainId = await dexWallet.wallet.getChainId();

  const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
  const decimals = await tokenContract.decimals();
  const symbol = await tokenContract.symbol();
  const name = await tokenContract.name();

  return new Token(chainId, tokenAddress, decimals, symbol, name);
}
