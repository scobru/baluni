import { ethers } from "ethers";
import { USDC, WNATIVE, ORACLE } from "../config";
import { POLYGON } from "../networks";
import OffChainOracleAbi from "./contracts/OffChainOracle.json";

interface Token {
  address: string;
  decimals: number;
}

export async function fetchPrices(token: Token): Promise<number> {
  const provider = new ethers.providers.JsonRpcProvider(POLYGON[0]);

  const offChainOracleAddress = ORACLE;
  const offchainOracle = new ethers.Contract(
    offChainOracleAddress,
    OffChainOracleAbi,
    provider
  );

  const rateUSD = await offchainOracle.getRate(
    WNATIVE,
    USDC, // source token
    true // use source wrappers
  );

  const rateUSDFormatted = rateUSD.mul(1e12);

  const rate = await offchainOracle.getRateToEth(
    token.address, // source token
    true // use source wrappers
  );

  const numerator = 10 ** token.decimals;
  const denominator = 1e18; // eth decimals
  const price = (parseFloat(rate) * numerator) / denominator / 1e18;
  const priceUSD = (price * rateUSDFormatted) / denominator;

  return priceUSD;
}
