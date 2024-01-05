import { fetchPriceData } from "./fetchPriceData";
import { trainAndPredict } from "./trainAndPredict";
import { LINEAR_REGRESSION_PERIOD } from "../config";

import { loadPrettyConsole } from "../utils/prettyConsole";
const prettyConsole = loadPrettyConsole();

//const [tokenSymbol] = process.argv.slice(2);

export async function predict() {
  // Set default if argument not provided
  const defaultTokenSymbol = "bitcoin";
  // CoinGecko likes timestamps in seconds, not ms
  const endDate: number = Math.floor(new Date().getTime() / 1000);
  const startDate = Math.floor(
    new Date(
      endDate * 1000 - LINEAR_REGRESSION_PERIOD * 24 * 60 * 60 * 1000
    ).getTime() / 1000
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

    console.group("*** Prediction ***");
    console.log("\n");
    prettyConsole.info(`Prediction for ${new Date(predictTime)}: ${results}`);
    prettyConsole.log("🌐 Actual price:");
    prettyConsole.print("black", "yellow", `${actualPrice}`);
    prettyConsole.log("📈 Predicted price:");
    prettyConsole.print("black", "yellow", `${results}`);
    console.groupEnd();

    return { actual: actualPrice, predicted: results };
  } catch (error) {
    console.error("Error:", error);
  }
}
