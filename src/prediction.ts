import { fetchPriceData } from "./predict/fetchPriceData";
import { trainAndPredict } from "./predict/trainAndPredict";
import { trainAndPredict1CONV } from "./predict/trainAndPredict1CONV";
import { loadPrettyConsole } from "./utils/prettyConsole";
import { trainAndPredictGRU } from "./predict/trainAndPredictGRU";
import { trainAndPredictLSTM } from "./predict/trainAndPredictLSTM";
import { trainAndPredictRNN } from "./predict/trainAndPredictRNN";

const [tokenSymbol] = process.argv.slice(2);
const [period] = process.argv.slice(3);
const [algo] = process.argv.slice(4);
const [epochs] = process.argv.slice(5);

const prettyConsole = loadPrettyConsole();

interface PredictionResult {
  actual: number;
  predicted: number;
}

export async function predict(): Promise<PredictionResult | void> {
  if (Number(period) <= 0) {
    console.error("Period must be a positive number.");
    return;
  }

  const endDate: number = Math.floor(new Date().getTime() / 1000);
  const startDate: number = endDate - Number(period) * 24 * 60 * 60;

  try {
    const { timePrices, predictTime, actualPrice } = await fetchPriceData(tokenSymbol, startDate, endDate);

    const predictionAlgorithms: { [key: string]: Function } = {
      "1CONV": trainAndPredict1CONV,
      GRU: trainAndPredictGRU,
      LSTM: trainAndPredictLSTM,
      RNN: trainAndPredictRNN,
      REGR: trainAndPredict,
    };

    const predictFunction = predictionAlgorithms[algo] || trainAndPredict;
    const results = await predictFunction(timePrices, predictTime,epochs);

    prettyConsole.info(`Prediction for ${new Date(predictTime * 1000).toISOString()}: ${results}`);
    prettyConsole.log(" 🌐 Actual price:", actualPrice);
    prettyConsole.log(" 📈 Predicted price:", results);

    return { actual: actualPrice, predicted: results };
  } catch (error) {
    console.error("Error:", error);
  }
}


predict();
