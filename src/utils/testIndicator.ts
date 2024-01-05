const {
  rsiCheck,
  stochasticrsi,
  getDetachSourceFromOHLCV,
} = require("trading-indicator");

async function main() {
  const { input } = await getDetachSourceFromOHLCV(
    "binance",
    `BTC/USDT`,
    "5m",
    false
  ); // true if you want to get future market

  const result = await stochasticrsi(3, 3, 14, 14, "close", input);
  console.log(result[result.length - 1]);

  // const result = await rsiCheck(14, "close", input);
  // console.log(result);
}

main();
