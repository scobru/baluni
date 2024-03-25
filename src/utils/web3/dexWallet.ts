import { ethers, BigNumber } from "ethers";
import dotenv from "dotenv";
dotenv.config();

export interface DexWallet {
  wallet: ethers.Wallet;
  walletAddress: string;
  walletBalance: BigNumber;
  providerGasPrice: BigNumber;
  walletProvider: ethers.providers.JsonRpcProvider;
}

export const initializeWallet = async (rpcUrl: string, pk?: string): Promise<DexWallet> => {
  const PRIVATE_KEY = String(pk ? pk : process.env.PRIVATE_KEY);

  if (!PRIVATE_KEY) {
    throw new Error("Private key missing from env variables");
  }

  const walletProvider = new ethers.providers.JsonRpcProvider(rpcUrl);

  // Sign the transaction with the contract owner's private key
  const wallet = new ethers.Wallet(PRIVATE_KEY, walletProvider);
  const walletAddress = await wallet.getAddress();

  const walletBalance = await wallet.getBalance();
  const providerGasPrice = await walletProvider.getGasPrice();

  return {
    wallet,
    walletAddress,
    walletBalance,
    providerGasPrice,
    walletProvider,
  };
};
