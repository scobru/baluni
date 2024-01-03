import {
  RSI_PERIOD,
  RSI_OVERBOUGHT,
  RSI_OVERSOLD,
  STOCKRSI_PERIOD,
} from "../config";
import { loadPrettyConsole } from "../utils/prettyConsole";

const prettyConsole = loadPrettyConsole();
export async function getRSI(symbol: string) {
  const {
    rsiCheck,
    stochasticrsi,
    getDetachSourceFromOHLCV,
  } = require("trading-indicator");

  if (symbol.startsWith("W")) {
    symbol = symbol.substring(1);
  }

  if (symbol == "MaticX") {
    symbol = "MATIC";
  }

  const { input } = await getDetachSourceFromOHLCV(
    "binance",
    `${symbol}/USDT`,
    "5m",
    false
  ); // true if you want to get future market

  const rsiResult = await rsiCheck(
    RSI_PERIOD,
    RSI_OVERBOUGHT,
    RSI_OVERSOLD,
    input
  );
  const stochasticRSIResult = await stochasticrsi(
    3,
    3,
    STOCKRSI_PERIOD,
    STOCKRSI_PERIOD,
    "close",
    input
  );

  prettyConsole.debug(
    `Getting RSI for:${symbol}`,
    `RSI:${rsiResult.rsiVal}`,
    `StochasticRSI:${
      stochasticRSIResult[stochasticRSIResult.length - 1].stochRSI
    }`
  );

  return [rsiResult, stochasticRSIResult[stochasticRSIResult.length - 1]];
}
