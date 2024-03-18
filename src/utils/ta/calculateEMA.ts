import { crossover, crossunder } from "./cross";

export const calculateEMA = async (symbol: string, config: any) => {
  const { ema, getDetachSourceFromOHLCV } = require("trading-indicator");
  const { input } = await getDetachSourceFromOHLCV("binance", `${symbol}/USDT`, config?.EMA_TIMEFRAME, false); // true if you want to get future market

  try {
    let EMA_FAST_VAL = await ema(parseInt(String(config?.EMA_FAST)), "close", input);
    let EMA_SLOW_VAL = await ema(parseInt(String(config?.EMA_SLOW)), "close", input);
    return {
      fast: EMA_FAST_VAL,
      slow: EMA_SLOW_VAL,
    };
  } catch (err) {
    throw err;
  }
};

//let emaFastVal, emaSlowVal
const egoldenCross = async (symbol: string, config: any) => {
  var emaFastVal;
  var emaSlowVal;

  //if (emaFastVal == undefined || emaSlowVal == undefined) {
  let emaVal = await calculateEMA(symbol, config);
  emaFastVal = emaVal.fast;
  emaSlowVal = emaVal.slow;
  //}

  return crossover(emaFastVal, emaSlowVal);
};

const edeathCross = async (symbol: string, config: any) => {
  var emaFastVal;
  var emaSlowVal;
  //if (emaFastVal == undefined || emaSlowVal == undefined) {
  let emaVal = await calculateEMA(symbol, config);
  emaFastVal = emaVal.fast;
  emaSlowVal = emaVal.slow;
  //}

  return crossunder(emaFastVal, emaSlowVal);
};

const emaCross = async (symbol: string, config: any) => {
  return {
    egoldenCross: await egoldenCross(symbol, config),
    edeathCross: await edeathCross(symbol, config),
  };
};

const priceCrossEMA = async (symbol: string, config: any) => {
  const { ema, getDetachSourceFromOHLCV } = require("trading-indicator");
  const { input } = await getDetachSourceFromOHLCV("binance", `${symbol}/USDT`, config?.EMA_TIMEFRAME, false);

  let maVal = await ema(parseInt(String(config?.EMA_PERIOD)), "close", input),
    price = input.slice(-2),
    up = crossover(price, maVal),
    down = crossunder(price, maVal);
  return {
    cross: up || down,
    direction: up ? "up" : down ? "down" : "none",
  };
};

const vwapCrossEMA = async (symbol: string, config: any) => {
  const { vwap, getDetachSourceFromOHLCV, ema } = require("trading-indicator");
  const { input } = await getDetachSourceFromOHLCV("binance", `${symbol}/USDT`, config?.EMA_TIMEFRAME, false);
  console.log(await vwap(input));

  let vwapResult = await vwap(input);

  let maVal = await ema(parseInt(String(config?.VWAP_PERIOD)), "close", input),
    price = vwapResult.slice(-2),
    up = crossover(price, maVal),
    down = crossunder(price, maVal);
  return {
    cross: up || down,
    direction: up ? "up" : down ? "down" : "none",
  };
};

module.exports = {
  emaCross,
  priceCrossEMA,
  vwapCrossEMA,
};
