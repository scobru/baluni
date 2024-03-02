import { EMA_PERIOD, EMA_TIMEFRAME } from "../config";
import { loadPrettyConsole } from "./prettyConsole";
const pc = loadPrettyConsole();

export async function getEMA(symbol: string) {
  const { ema, getDetachSourceFromOHLCV } = require("trading-indicator");

  if (symbol.startsWith("W")) {
    symbol = symbol.substring(1);
  }

  if (symbol == "MaticX") {
    symbol = "MATIC";
  }

  const { input } = await getDetachSourceFromOHLCV("binance", `${symbol}/USDT`, EMA_TIMEFRAME, false); // true if you want to get future market
  let emaData = await ema(EMA_PERIOD, "close", input);
  console.log(emaData[emaData.length - 1]);

  pc.info(`⚙️ Getting EMA ${EMA_PERIOD}  for:${symbol}`, `EMA:${emaData[emaData.length - 1]}`);

  return [emaData[emaData.length - 1]];
}
