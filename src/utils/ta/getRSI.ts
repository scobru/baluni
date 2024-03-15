import { loadPrettyConsole } from "../prettyConsole";
const pc = loadPrettyConsole();

export async function getRSI(symbol: string, config: any) {
  const { rsiCheck, stochasticrsi, getDetachSourceFromOHLCV } = require("trading-indicator");

  if (symbol.startsWith("W")) {
    symbol = symbol.substring(1);
  }

  if (symbol == "MaticX") {
    symbol = "MATIC";
  }

  const { input } = await getDetachSourceFromOHLCV("binance", `${symbol}/USDT`, config?.RSI_TIMEFRAME, false); // true if you want to get future market

  const rsiResult = await rsiCheck(config?.RSI_PERIOD, config?.RSI_OVERBOUGHT, config?.RSI_OVERSOLD, input);
  const stochasticRSIResult = await stochasticrsi(
    3,
    3,
    config?.STOCKRSI_PERIOD,
    config?.STOCKRSI_PERIOD,
    "close",
    input,
  );

  pc.info(
    `⚙️ Getting RSI for:${symbol}`,
    `RSI:${rsiResult.rsiVal}`,
    `StochasticRSI:${stochasticRSIResult[stochasticRSIResult.length - 1].stochRSI}`,
  );

  return [rsiResult, stochasticRSIResult[stochasticRSIResult.length - 1]];
}
