import { BigNumber, ethers } from "ethers";
import { formatEther } from "ethers/lib/utils";
import { fetchPrices } from "./quote1Inch";

export async function getTokenValue(
  tokenSymbol: string,
  token: string,
  balance: BigNumber,
  decimals: number,
  usdcAddress: string,
  chainId: string,
): Promise<BigNumber> {
  if (token === usdcAddress) {
    return balance; // USDT value is the balance itself
  } else {
    const tokenPriceBaseUrl = "https://api.odos.xyz/pricing/token";

    // const price = await quotePair(token, usdcAddress);
    const _token = {
      address: token,
      decimals: decimals,
    };

    const response = await fetch(`${tokenPriceBaseUrl}/${chainId}/${token}`);
    let price;
    if (response.status === 200) {
      const tokenPrice = await response.json();
      price = tokenPrice.price;
    } else {
      console.error("Error in Transaction Assembly:", response);
      // handle token price failure cases
    }

    //const price: any = await fetchPrices(_token, chainId);

    if (!price) throw new Error("Price is undefined");

    let pricePerToken = ethers.utils.parseUnits(price.toString(), 18); // Assume price is in 18 decimals
    let value;

    if (decimals == 8) {
      value = balance.mul(1e10).mul(pricePerToken).div(BigNumber.from(10).pow(18)); // Adjust for token's value
    } else if (decimals == 6) {
      value = balance.mul(1e12).mul(pricePerToken).div(BigNumber.from(10).pow(18)); // Adjust for token's value
    } else {
      value = balance.mul(pricePerToken).div(BigNumber.from(10).pow(18)); // Adjust for token's value
    }

    const _balance = decimals == 8 ? formatEther(String(Number(balance) * 1e10)) : formatEther(balance.toString());

    console.group(`🔤 Token Symbol: ${tokenSymbol}`);
    console.log(`📄 Token: ${token}`);
    console.log(`👛 Balance: ${_balance}`);
    console.log(`📈 Price: ${price?.toString()}`);
    console.log(`💵 Value: ${formatEther(value.toString())}`);
    console.groupEnd();

    return value;
  }
}
