import { fetchPriceData } from "./fetchPriceData";
import { trainAndPredict } from "./trainAndPredict";
import { PrettyConsole } from "../utils/prettyConsole";

const prettyConsole = new PrettyConsole();
prettyConsole.clear();
prettyConsole.closeByNewLine = true;
prettyConsole.useIcons = true;
//const [tokenSymbol] = process.argv.slice(2);

export async function predict() {
  // Set default if argument not provided
  const defaultTokenSymbol = "bitcoin";
  // CoinGecko likes timestamps in seconds, not ms
  const endDate: number = Math.floor(new Date().getTime() / 1000);
  const startDate = Math.floor(
    new Date(endDate * 1000 - 90 * 24 * 60 * 60 * 1000).getTime() / 1000
  );

  // Use default values if arguments are not present
  //const finalTokenSymbol = tokenSymbol || defaultTokenSymbol;
  const finalTokenSymbol = defaultTokenSymbol;

  try {
    const { timePrices, predictTime, actualPrice } = await fetchPriceData(
      finalTokenSymbol,
      startDate,
      endDate
    );
    const results = await trainAndPredict(timePrices, predictTime);
    prettyConsole.log(`Prediction for ${new Date(predictTime)}: ${results} `);
    prettyConsole.log(`Actual: ${actualPrice}`);
    return { actual: actualPrice, predicted: results };
  } catch (error) {
    console.error("Error:", error);
  }
}
