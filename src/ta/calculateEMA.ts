import { EMA_TIMEFRAME, EMA_FAST, EMA_SLOW, EMA_PERIOD, VWAP_PERIOD } from "../config";
import { crossover, crossunder } from "../utils/cross";

export const calculateEMA = async (symbol: string) => {
  const { ema, getDetachSourceFromOHLCV } = require("trading-indicator");
  const { input } = await getDetachSourceFromOHLCV("binance", `${symbol}/USDT`, EMA_TIMEFRAME, false); // true if you want to get future market

  try {
    let EMA_FAST_VAL = await ema(parseInt(String(EMA_FAST)), "close", input);
    let EMA_SLOW_VAL = await ema(parseInt(String(EMA_SLOW)), "close", input);
    return {
      fast: EMA_FAST_VAL,
      slow: EMA_SLOW_VAL,
    };
  } catch (err) {
    throw err;
  }
};

//let emaFastVal, emaSlowVal
const egoldenCross = async (symbol: string) => {
  var emaFastVal;
  var emaSlowVal;

  //if (emaFastVal == undefined || emaSlowVal == undefined) {
  let emaVal = await calculateEMA(symbol);
  emaFastVal = emaVal.fast;
  emaSlowVal = emaVal.slow;
  //}

  return crossover(emaFastVal, emaSlowVal);
};

const edeathCross = async (symbol: string) => {
  var emaFastVal;
  var emaSlowVal;
  //if (emaFastVal == undefined || emaSlowVal == undefined) {
  let emaVal = await calculateEMA(symbol);
  emaFastVal = emaVal.fast;
  emaSlowVal = emaVal.slow;
  //}

  return crossunder(emaFastVal, emaSlowVal);
};

const emaCross = async (symbol: string) => {
  return {
    egoldenCross: await egoldenCross(symbol),
    edeathCross: await edeathCross(symbol),
  };
};

const priceCrossEMA = async (symbol: string) => {
  const { ema, getDetachSourceFromOHLCV } = require("trading-indicator");
  const { input } = await getDetachSourceFromOHLCV("binance", `${symbol}/USDT`, EMA_TIMEFRAME, false);

  let maVal = await ema(parseInt(String(EMA_PERIOD)), "close", input),
    price = input.slice(-2),
    up = crossover(price, maVal),
    down = crossunder(price, maVal);
  return {
    cross: up || down,
    direction: up ? "up" : down ? "down" : "none",
  };
};

const vwapCrossEMA = async (symbol: string) => {
  const { vwap, getDetachSourceFromOHLCV, ema } = require("trading-indicator");
  const { input } = await getDetachSourceFromOHLCV("binance", `${symbol}/USDT`, EMA_TIMEFRAME, false);
  console.log(await vwap(input));

  let vwapResult = await vwap(input);

  let maVal = await ema(parseInt(String(VWAP_PERIOD)), "close", input),
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
