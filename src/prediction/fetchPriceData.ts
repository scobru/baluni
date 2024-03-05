import { loadPrettyConsole } from "../utils/prettyConsole";
import fetch from "node-fetch";

const prettyConsole = loadPrettyConsole();

export async function fetchPriceData(tokenSymbol: string, fromTimestamp: number, toTimestamp: number) {
  try {
    const url = `https://api.coingecko.com/api/v3/coins/${tokenSymbol}/market_chart/range?vs_currency=usd&from=${fromTimestamp}&to=${toTimestamp}`;
    console.log(url);

    prettyConsole.log("Getting price data from: " + url);
    const response = await fetch(url);
    const data = await response.json();

    if (data && data.prices) {
      prettyConsole.info(`Got ${data.prices.length} data points`);
      const lastElement = data.prices.pop();
      const pricesButLast = data.prices.slice(0, data.prices.length - 1);
      return {
        timePrices: pricesButLast,
        predictTime: lastElement[0],
        actualPrice: lastElement[1],
      };
    } else {
      prettyConsole.log("No price data available.");
    }
  } catch (error) {
    console.error("Error fetching data:", error);
  }

  // Return default values if execution reaches this point
  return { timePrices: [], predictTime: null, actualPrice: null };
}
