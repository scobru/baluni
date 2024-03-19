import { loadPrettyConsole } from "../../utils/prettyConsole";
const pc = loadPrettyConsole();

export async function getEMA(symbol: string, config: any) {
  const { ema, getDetachSourceFromOHLCV } = require("trading-indicator");

  if (symbol.startsWith("W")) {
    symbol = symbol.substring(1);
  }

  if (symbol == "MaticX") {
    symbol = "MATIC";
  }

  const { input } = await getDetachSourceFromOHLCV("binance", `${symbol}/USDT`, config?.EMA_TIMEFRAME, false); // true if you want to get future market
  let emaData = await ema(config?.EMA_PERIOD, "close", input);
  console.log(emaData[emaData.length - 1]);

  pc.info(`⚙️ Getting EMA ${config?.EMA_PERIOD}  for:${symbol}`, `EMA:${emaData[emaData.length - 1]}`);

  return [emaData[emaData.length - 1]];
}
