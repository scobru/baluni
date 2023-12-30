import { PrettyConsole } from "../utils/prettyConsole";

const prettyConsole = new PrettyConsole();
prettyConsole.clear();
prettyConsole.closeByNewLine = true;
prettyConsole.useIcons = true;

export async function fetchPriceData(
  tokenSymbol: string,
  fromTimestamp: number,
  toTimestamp: number
) {
  try {
    // https://api.coingecko.com/api/v3/coins/bitcoin/market_chart/range?vs_currency=usd&from=1689105076412&to=1691697076412
    const url = `https://api.coingecko.com/api/v3/coins/${tokenSymbol}/market_chart/range?vs_currency=usd&from=${fromTimestamp}&to=${toTimestamp}`;
    prettyConsole.log("Getting price data from: " + url);
    const response = await fetch(url);
    const data = await response.json();
    prettyConsole.info(`Got ${data.prices.length} data points`);

    if (data && data.prices) {
      const lastElement = data.prices.pop();
      const pricesButLast = data.prices.slice(0, data.prices.length - 1);
      return {
        timePrices: pricesButLast,
        predictTime: lastElement[0],
        actualPrice: lastElement[1],
      };
    } else {
      prettyConsole.log("No price data available.");
      return { pricesButLast: [], lastElement: null };
    }
  } catch (error) {
    console.error("Error fetching data:", error);
    return { pricesButLast: [], lastElement: null };
  }
}