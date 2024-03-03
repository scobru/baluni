import { ethers } from "ethers";
import OffChainOracleAbi from "../abis/OffChainOracle.json";

interface Token {
  address: string;
  decimals: number;
}

export async function fetchPrices(token: Token, config: any): Promise<number> {
  const rpcUrl = config?.NETWORKS;
  const provider = new ethers.providers.JsonRpcProvider(rpcUrl);

  const offChainOracleAddress = config?.ORACLE;

  const offchainOracle = new ethers.Contract(offChainOracleAddress, OffChainOracleAbi, provider);

  const rateUSD = await offchainOracle.getRate(
    config?.WNATIVE, // destination token
    config?.USDC, // source token
    true, // use source wrappers
  );

  const rateUSDFormatted = rateUSD.mul(1e12);

  const rate = await offchainOracle.getRateToEth(
    token.address, // source token
    true, // use source wrappers
  );

  const numerator = 10 ** token.decimals;
  const denominator = 1e18; // eth decimals
  const price = (parseFloat(rate) * numerator) / denominator / 1e18;
  const priceUSD = (price * rateUSDFormatted) / denominator;

  return priceUSD;
}
