import { fetchPriceData } from "./fetchPriceData";
import { trainAndPredict } from "./trainAndPredict";
import { trainAndPredict1CONV } from "./trainAndPredict1CONV";
import { loadPrettyConsole } from "../utils/prettyConsole";
import { trainAndPredictGRU } from "./trainAndPredictGRU";
import { trainAndPredictLSTM } from "./trainAndPredictLSTM";
import { trainAndPredictRNN } from "./trainAndPredictRNN";

const prettyConsole = loadPrettyConsole();

interface PredictionResult {
  actual: number;
  predicted: number;
}

export async function predict(algo: string, tokenSymbol: string = "bitcoin", period: number , epochs: number): Promise<PredictionResult | void> {
  if (period <= 0) {
    console.error("Period must be a positive number.");
    return;
  }

  const endDate: number = Math.floor(new Date().getTime()  / 1000) ;
  const startDate: number = endDate - period * 24 * 60 * 60;

  try {
    const { timePrices, predictTime, actualPrice } = await fetchPriceData(tokenSymbol, startDate, endDate);

    const predictionAlgorithms: { [key: string]: Function } = {
      "1CONV": trainAndPredict1CONV,
      GRU: trainAndPredictGRU,
      LSTM: trainAndPredictLSTM,
      RNN: trainAndPredictRNN,
      REGR: trainAndPredict,
    };

    prettyConsole.log("Algo:", predictionAlgorithms);
    prettyConsole.log("Epochs:", epochs);


    const predictFunction = predictionAlgorithms[algo] || trainAndPredict;
    const results = await predictFunction(timePrices, predictTime, epochs);

    prettyConsole.info(`Prediction for ${new Date(predictTime * 1000).toISOString()}: ${results}`);
    prettyConsole.log(" 🌐 Actual price:", actualPrice);
    prettyConsole.log(" 📈 Predicted price:", results);

    return { actual: actualPrice, predicted: results };
  } catch (error) {
    console.error("Error:", error);
  }
}
