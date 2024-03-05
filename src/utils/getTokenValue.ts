import { BigNumber, ethers } from "ethers";
import { formatEther } from "ethers/lib/utils";
import { fetchPrices } from "../protocols/1inch/quote1Inch";
import { loadPrettyConsole } from "./prettyConsole";

const prettyConsole = loadPrettyConsole();

export async function getTokenValue(
  tokenSymbol: string,
  token: string,
  balance: BigNumber,
  decimals: number,
  usdcAddress: string,
  config: any,
): Promise<BigNumber> {
  if (token === usdcAddress) {
    return balance; // USDT value is the balance itself
  } else {
    // const price = await quotePair(token, usdcAddress);
    const _token = {
      address: token,
      decimals: decimals,
    };
    const price: any = await fetchPrices(_token, config);

    if (!price) throw new Error("Price is undefined");
    // Here, ensure that the price is parsed with respect to the token's decimals

    let pricePerToken = ethers.utils.parseUnits(price.toString(), 18); // Assume price is in 18 decimals
    let value;

    if (decimals == 8) {
      value = balance.mul(1e10).mul(pricePerToken).div(BigNumber.from(10).pow(18)); // Adjust for token's value
    } else {
      value = balance.mul(pricePerToken).div(BigNumber.from(10).pow(18)); // Adjust for token's value
    }

    const _balance = decimals == 8 ? formatEther(String(Number(balance) * 1e10)) : formatEther(balance.toString());

    prettyConsole.log(
      `🔤 Token Symbol: ${tokenSymbol}`,
      `📄 Token: ${token}`,
      `👛 Balance:${_balance}`,
      `📈 Price:${price?.toString()}`,
      `💵 Value:${formatEther(value.toString())}`,
    );
    return value;
  }
}
