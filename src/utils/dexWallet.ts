import { ethers, BigNumber } from "ethers";
import dotenv from "dotenv";
dotenv.config();

export interface DexWallet {
  wallet: ethers.Wallet;
  walletAddress: string;
  walletBalance: BigNumber;
  providerGasPrice: BigNumber;
  walletProvider?: any;
}

export const initializeWallet = async (
  network?: string
): Promise<DexWallet> => {
  const PRIVATE_KEY = String(process.env.PRIVATE_KEY);

  if (!PRIVATE_KEY) {
    throw new Error("Private key missing from env variables");
  }

  const provider = network
    ? // Connect to the user pprovided network
      new ethers.providers.JsonRpcProvider(network)
    : // Connect to Ethereum mainnet
      ethers.getDefaultProvider();

  // Sign the transaction with the contract owner's private key
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

  const walletAddress = await wallet.getAddress();
  const walletBalance = await wallet.getBalance();

  const providerGasPrice = await provider.getGasPrice();

  return {
    wallet,
    walletAddress,
    walletBalance,
    providerGasPrice,
  };
};
