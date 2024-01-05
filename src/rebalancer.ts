import { initializeWallet } from "./utils/dexWallet";
import { rebalancePortfolio } from "./uniswap/rebalance";
import {
  TOKENS,
  WEIGHTS_UP,
  WEIGHTS_DOWN,
  USDC,
  INTERVAL,
  LINEAR_REGRESSION,
} from "./config";
import { POLYGON } from "./utils/networks";
import { predict } from "./predict/predict";
import { PrettyConsole } from "./utils/prettyConsole";

const prettyConsole = new PrettyConsole();

prettyConsole.clear();
prettyConsole.closeByNewLine = true;
prettyConsole.useIcons = true;

async function rebalancer() {
  welcomeMessage();

  await executeRebalance();

  try {
    // Initialize your DexWallet here
    setInterval(async () => {
      try {
        await executeRebalance();
      } catch (error) {
        prettyConsole.error("Error during rebalancing:", error);
      }
    }, INTERVAL * 1000); // 1 minute = 60000 ms
  } catch (error) {
    prettyConsole.error("Error during initialization:", error);
  }
}

function welcomeMessage() {
  console.log(
    `\n` +
      " __                  __                      __ \n" +
      "/  |                /  |                    /  |\n" +
      "$$ |____    ______  $$ | __    __  _______  $$/ \n" +
      "$$      \\  /      \\ $$ |/  |  /  |/       \\ /  |\n" +
      "$$$$$$$  | $$$$$$  |$$ |$$ |  $$ |$$$$$$$  |$$ |\n" +
      "$$ |  $$ | /    $$ |$$ |$$ |  $$ |$$ |  $$ |$$ |\n" +
      "$$ |__$$ |/$$$$$$$ |$$ |$$ \\__$$ |$$ |  $$ |$$ |\n" +
      "$$    $$/ $$    $$ |$$ |$$    $$/ $$ |  $$ |$$ |\n" +
      "$$$$$$$/   $$$$$$$/ $$/  $$$$$$/  $$/   $$/ $$/ \n" +
      "                                                \n"
  );

  console.log(
    `\n` +
      '                 ,-""""-.\n' +
      "               ,'      _ `.\n" +
      "              /       )_)  \\\n" +
      "             :              :\n" +
      "             \\              /\n" +
      "              \\            /\n" +
      "               `.        ,'\n" +
      "                 `.    ,'\n" +
      "                   `.,'\n" +
      "                    /\\`.   ,-._\n" +
      "                        `-'"
      "                             .\n" +
      "              s                \\\n" +
      "                               \\\\\n" +
      "                                \\\\\n" +
      "                                 >\\/7\n" +
      "                             _.-(6'  \\\n" +
      "                            (=___._/` \\\n" +
      "                                 )  \\ |\n" +
      "                                /   / |\n" +
      "                               /    > /\n" +
      "                              j    < _\\\n" +
  );

  console.log("\n", "Please wait...");
  console.log(
    "This is an experimental project. Use at your own risk. No financial advice is given."
  );
  console.log("\n", "\n");
}

async function executeRebalance() {
  prettyConsole.log("Checking portfolio");
  const dexWallet = await initializeWallet(POLYGON[0]);
  let selectedWeights = WEIGHTS_UP;

  const { kstCross, getDetachSourceFromOHLCV } = require("trading-indicator");

  const { input } = await getDetachSourceFromOHLCV(
    "binance",
    "BTC/USDT",
    "1h",
    false
  ); // true if you want to get future market

  // kstCross(input, roc1, roc2, roc3, roc4, sma1, sma2, sma3, sma4, signalPeriod)
  // Calculate KST
  const kstResult = await kstCross(input, 10, 15, 20, 30, 10, 10, 10, 15, 9);

  prettyConsole.debug("KST:", kstResult);

  // Calculate AI signal
  let signalAI = "none";

  const linearRegression: any = await predict();

  if (linearRegression.predicted > linearRegression.actual) {
    signalAI = "up";
  } else if (linearRegression.predicted < linearRegression.actual) {
    signalAI = "down";
  }

  console.group();
  prettyConsole.debug("Signal AI:", signalAI);
  prettyConsole.print("black", "yellow", signalAI);
  prettyConsole.debug("KST trend:");
  prettyConsole.print("black", "yellow", kstResult.direction);
  console.groupEnd();

  const writeLog = async function writeLog() {
    const fs = require("fs");
    const time = new Date().toISOString();
    const data = `${time}, ${kstResult.direction}, ${kstResult.cross}, ${String(
      signalAI
    )}\n`;
    fs.appendFile("log.txt", data, function (err: any) {
      if (err) throw err;
      console.log("Saved!");
    });
  };

  // Calculate final signal
  if (
    kstResult.direction == "up" &&
    kstResult.cross == true &&
    signalAI == "up" &&
    LINEAR_REGRESSION
  ) {
    selectedWeights = WEIGHTS_UP;
    await writeLog();
  } else if (
    kstResult.direction == "up" &&
    kstResult.cross == true &&
    !LINEAR_REGRESSION
  ) {
    selectedWeights = WEIGHTS_UP;
    await writeLog();
  }

  if (
    kstResult.direction == "down" &&
    kstResult.cross == "true" &&
    signalAI == "down"
  ) {
    selectedWeights = WEIGHTS_DOWN;
    await writeLog();
  } else if (
    kstResult.direction == "down" &&
    kstResult.cross == "true" &&
    !LINEAR_REGRESSION
  ) {
    selectedWeights = WEIGHTS_DOWN;
    await writeLog();
  }

  prettyConsole.info("Selected weights:", selectedWeights);
  await rebalancePortfolio(dexWallet, TOKENS, selectedWeights, USDC);
}

async function main() {
  await rebalancer();
}

main().catch((error) => {
  prettyConsole.error("An error occurred:", error);
});
