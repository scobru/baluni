import ERC20_ABI from "../abis/common/ERC20.json";
import { Token } from "@uniswap/sdk-core";
import { ethers } from "ethers";

export async function getTokenMetadata(tokenAddress: string, walletProvider: any) {
  const chainId = walletProvider.network.chainId;
  const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, walletProvider);

  const decimals = await tokenContract.decimals();
  const symbol = await tokenContract.symbol();
  const name = await tokenContract.name();

  return new Token(chainId, tokenAddress, decimals, symbol, name);
}
