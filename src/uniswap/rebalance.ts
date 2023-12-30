import { BigNumber, Contract, ethers } from "ethers";
import { DexWallet } from "../dexWallet";
import { callContractMethod } from "../contractUtils";
import { waitForTx } from "../networkUtils";
import erc20Abi from "./contracts/ERC20.json";
import quoterAbi from "./contracts/Quoter.json";
import swapRouterAbi from "./contracts/SwapRouter.json";
import { formatEther, parseEther } from "ethers/lib/utils";
import { LIMIT, ROUTER, QUOTER, SLIPPAGE } from "../config";
import { fetchPrices } from "./quote1Inch";
import { POLYGON } from "../networks";
import { rechargeFees } from "./rechargeFees";
import { PrettyConsole } from "../utils/prettyConsole";

const prettyConsole = new PrettyConsole();
prettyConsole.clear();
prettyConsole.closeByNewLine = true;
prettyConsole.useIcons = true;

export async function swapCustom(
  dexWallet: DexWallet,
  pair: [string, string],
  reverse?: boolean,
  swapAmount?: BigNumber
) {
  if (!swapAmount || swapAmount.isZero()) {
    prettyConsole.error("Swap amount must be a positive number.");
    return;
  }

  const { wallet, walletAddress, providerGasPrice } = dexWallet;
  const tokenAAddress = reverse ? pair[1] : pair[0];
  const tokenBAddress = reverse ? pair[0] : pair[1];
  const tokenAContract = new Contract(tokenAAddress, erc20Abi, wallet);
  const tokenBContract = new Contract(tokenBAddress, erc20Abi, wallet);
  const tokenAName = await tokenAContract.symbol();
  const tokenBName = await tokenBContract.symbol();
  const swapRouterAddress = ROUTER;

  const swapRouterContract = new Contract(
    swapRouterAddress,
    swapRouterAbi,
    wallet
  );

  const quoterContract = new Contract(QUOTER, quoterAbi, wallet);
  const gasPrice: BigNumber = providerGasPrice.mul(12).div(10);

  prettyConsole.log(
    `Actual gas price: ${gasPrice.toBigInt()}`,
    `Provider gas price: ${providerGasPrice.toBigInt()}`
  );

  const allowance: BigNumber = await tokenAContract.allowance(
    walletAddress,
    swapRouterAddress
  );
  prettyConsole.log("Token A spenditure allowance:", allowance.toBigInt());

  if (allowance.lt(swapAmount)) {
    prettyConsole.log("Approving spending of token A for swap");
    const approvalResult = await callContractMethod(
      tokenAContract,
      "approve",
      [swapRouterAddress, swapAmount],
      gasPrice
    );
    const broadcasted = await waitForTx(wallet.provider, approvalResult.hash);

    if (!broadcasted) {
      throw new Error(`TX broadcast timeout for ${approvalResult.hash}`);
    } else {
      prettyConsole.success(`Spending of ${swapAmount.toString()} approved.`);
    }
  }

  prettyConsole.log(`Swap ${tokenAName} for ${tokenBName}`);
  const swapDeadline = Math.floor(Date.now() / 1000 + 60 * 60); // 1 hour from now
  const slippageTolerance = SLIPPAGE;
  const expectedAmountB = await quoterContract.callStatic.quoteExactInputSingle(
    tokenAAddress,
    tokenBAddress,
    3000,
    swapAmount.toString(),
    0
  );

  prettyConsole.log(
    `Amount A: ${swapAmount.toString()}`,
    `Expected amount B: ${expectedAmountB.toString()}`
  );

  const minimumAmountB = expectedAmountB
    .mul(10000 - slippageTolerance)
    .div(10000);

  const swapTxInputs = [
    tokenAAddress,
    tokenBAddress,
    BigNumber.from(3000),
    walletAddress,
    BigNumber.from(swapDeadline),
    swapAmount,
    minimumAmountB, // BigNumber.from(0),
    BigNumber.from(0),
  ];

  const swapTxResponse = await callContractMethod(
    swapRouterContract,
    "exactInputSingle",
    [swapTxInputs],
    gasPrice
  );

  return swapTxResponse;
}

export async function rebalancePortfolio(
  dexWallet: DexWallet,
  desiredTokens: string[],
  desiredAllocations: { [token: string]: number },
  usdcAddress: string
) {
  prettyConsole.log(
    "**************************************************************************"
  );
  prettyConsole.log("Rebalance Portfolio\n", "Check Gas and Recharge\n");
  await rechargeFees();

  const usdContract = new Contract(usdcAddress, erc20Abi, dexWallet.wallet);
  const usdBalance = await usdContract?.balanceOf(dexWallet.walletAddress);

  //let totalPortfolioValue = BigNumber.from(usdBalance.mul(1e12).toString());
  let totalPortfolioValue = BigNumber.from(0);
  prettyConsole.info(
    "Total Portfolio Value (in USDT) at Start: ",
    formatEther(totalPortfolioValue)
  );

  let tokenValues: { [token: string]: BigNumber } = {};
  // First, calculate the current value of each token in the portfolio
  for (const token of desiredTokens) {
    const tokenContract = new ethers.Contract(
      token,
      erc20Abi,
      dexWallet.wallet
    );
    const tokenBalance = await tokenContract.balanceOf(dexWallet.walletAddress);
    const decimals = await getDecimals(token);
    const tokenSymbol = await tokenContract.symbol();
    let tokenValue;
    if (tokenSymbol === "USDC") {
      tokenValue = BigNumber.from(tokenBalance.toString()).mul(1e12);
    } else {
      tokenValue = await getTokenValue(
        tokenSymbol,
        token,
        tokenBalance,
        decimals,
        usdcAddress,
        dexWallet.wallet
      );
    }
    tokenValues[token] = tokenValue;
    totalPortfolioValue = totalPortfolioValue.add(tokenValue);
  }
  prettyConsole.info(
    "Total Portfolio Value (in USDT): ",
    formatEther(totalPortfolioValue)
  );

  let currentAllocations: { [token: string]: number } = {};

  Object.keys(tokenValues).forEach((token) => {
    currentAllocations[token] = tokenValues[token]
      .mul(10000)
      .div(totalPortfolioValue)
      .toNumber(); // Store as percentage
  });

  // Segregate tokens into sell and buy lists
  let tokensToSell = [];
  let tokensToBuy = [];

  for (const token of desiredTokens) {
    const currentAllocation = currentAllocations[token]; // current allocation as percentage
    const desiredAllocation = desiredAllocations[token];
    const difference = desiredAllocation - currentAllocation; // Calculate the difference for each token
    const tokenContract = new ethers.Contract(
      token,
      erc20Abi,
      dexWallet.wallet
    );
    const tokenBalance = await tokenContract.balanceOf(dexWallet.walletAddress);
    const tokenSymbol = await tokenContract.symbol();

    const valueToRebalance = totalPortfolioValue
      .mul(BigNumber.from(Math.abs(difference)))
      .div(10000); // USDT value to rebalance

    const decimals = await getDecimals(token);
    const tokenBalanceFormatted =
      decimals == 8
        ? formatEther(String(Number(tokenBalance) * 1e10))
        : formatEther(tokenBalance);

    prettyConsole.info(
      `Token: ${token}`,
      `Current Allocation: ${currentAllocation}%`,
      `Difference: ${difference}%`,
      `Value (USD): ${formatEther(tokenValues[token])}`,
      `Value to Rebalance (USD): ${formatEther(valueToRebalance)}`,
      `Balance: ${tokenBalanceFormatted} ${tokenSymbol}`
    );

    if (difference < 0 && Math.abs(difference) > LIMIT) {
      // Calculate token amount to sell
      //const tokenPriceInUSDT = await quotePair(token, usdcAddress);
      const decimals = await getDecimals(token);
      const _token = {
        address: token,
        decimals: decimals,
      };

      const tokenPriceInUSDT: any = await fetchPrices(_token); // Ensure this returns a value
      const pricePerToken = ethers.utils.parseUnits(
        tokenPriceInUSDT!.toString(),
        "ether"
      );

      const tokenAmountToSell = valueToRebalance
        .mul(BigNumber.from(10).pow(decimals))
        .div(pricePerToken);

      tokensToSell.push({ token, amount: tokenAmountToSell });
    } else if (difference > 0 && Math.abs(difference) > LIMIT) {
      // For buying, we can use valueToRebalance directly as we will be spending USDT
      tokensToBuy.push({ token, amount: valueToRebalance.div(1e12) });
    }
  }

  for (let { token, amount } of tokensToSell) {
    if (token === usdcAddress) {
      prettyConsole.log("SKIPPING USDC");
      break;
    }
    prettyConsole.assert(`Selling ${formatEther(amount)} worth of ${token}`);
    const tokenContract = new Contract(token, erc20Abi, dexWallet.wallet);
    const tokenSymbol = await tokenContract.symbol();
    const [rsiResult, stochasticRSIResult] = await getRSI(tokenSymbol);
    if (stochasticRSIResult > 80) {
      // Call swapCustom or equivalent function to sell the token
      // Assume that the swapCustom function takes in the token addresses, direction, and amount in token units
      await swapCustom(dexWallet, [token, usdcAddress], false, amount); // true for reverse because we're selling
      await new Promise((resolve) => setTimeout(resolve, 5000));
    } else {
      prettyConsole.warn("Waiting for StochRSI overBought");
    }
  }

  // Execute purchases next
  for (let { token, amount } of tokensToBuy) {
    if (token === usdcAddress) {
      prettyConsole.log("SKIPPING USDC");
      break;
    }
    prettyConsole.assert(
      `Buying ${Number(amount) / 1e6} USDC worth of ${token}`
    );
    const tokenContract = new Contract(token, erc20Abi, dexWallet.wallet);
    const tokenSymbol = await tokenContract.symbol();

    const [rsiResult, stochasticRSIResult] = await getRSI(tokenSymbol);

    // Call swapCustom or equivalent function to buy the token
    // Here we're assuming that swapCustom is flexible enough to handle both buying and selling
    const usdContract = new Contract(usdcAddress, erc20Abi, dexWallet.wallet);
    const usdBalance = await usdContract?.balanceOf(dexWallet.walletAddress);
    prettyConsole.info(
      `Amount to Swap ${Number(amount)}`,
      `Usd Balance ${Number(usdBalance)}`
    );

    if (stochasticRSIResult.stochRSI < 20) {
      if (Number(usdBalance) > Number(amount)) {
        prettyConsole.assert(
          `Buying ${Number(amount) / 1e6} worth of ${token}`
        );

        await swapCustom(dexWallet, [token, usdcAddress], true, amount); // false for reverse because we're buying
        // wait 5 seconds before moving on to the next token
        await new Promise((resolve) => setTimeout(resolve, 5000));
      } else if (
        Number(usdBalance) < Number(amount) &&
        Number(usdBalance) > (Number(amount) * 6000) / 10000
      ) {
        prettyConsole.log("Use all USDT to buy");
        await swapCustom(dexWallet, [token, usdcAddress], true, usdBalance);
      } else {
        prettyConsole.log(
          "Not enough USDT to buy, balance under 60% of required USD"
        );
      }
    } else {
      prettyConsole.warn("Waiting for StochRSI OverSold");
    }
  }
  prettyConsole.success("Rebalance completed.");
}

// Add the function to fetch token decimals if not already present.
async function getDecimals(tokenAddress: string): Promise<number> {
  const provider = new ethers.providers.JsonRpcProvider(POLYGON[0]);
  const tokenContract = new ethers.Contract(tokenAddress, erc20Abi, provider);
  return tokenContract.decimals();
}

async function getTokenValue(
  tokenSymbol: string,
  token: string,
  balance: BigNumber,
  decimals: number,
  usdcAddress: string,
  wallet: ethers.Wallet
): Promise<BigNumber> {
  if (token === usdcAddress) {
    return balance; // USDT value is the balance itself
  } else {
    // const price = await quotePair(token, usdcAddress);
    const _token = {
      address: token,
      decimals: decimals,
    };
    const price: any = await fetchPrices(_token);

    if (!price) throw new Error("Price is undefined");
    // Here, ensure that the price is parsed with respect to the token's decimals

    let pricePerToken = ethers.utils.parseUnits(price.toString(), 18); // Assume price is in 18 decimals
    let value;

    if (decimals == 8) {
      value = balance
        .mul(1e10)
        .mul(pricePerToken)
        .div(BigNumber.from(10).pow(18)); // Adjust for token's value
    } else {
      value = balance.mul(pricePerToken).div(BigNumber.from(10).pow(18)); // Adjust for token's value
    }

    const _balance =
      decimals == 8
        ? formatEther(String(Number(balance) * 1e10))
        : formatEther(balance.toString());

    prettyConsole.info(
      `Token Symbol: ${tokenSymbol}`,
      `Token: ${token}`,
      `Balance:${_balance}`,
      `Price:${price?.toString()}`,
      `Value:${formatEther(value.toString())}`
    );
    return value;
  }
}

async function getRSI(symbol: string) {
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

  const rsiResult = await rsiCheck(8, 70, 30, input);
  const stochasticRSIResult = await stochasticrsi(3, 3, 14, 14, "close", input);

  prettyConsole.debug(
    `Getting RSI for:${symbol}`,
    `RSI:${rsiResult.rsiVal}`,
    `StochasticRSI:${
      stochasticRSIResult[stochasticRSIResult.length - 1].stochRSI
    }`
  );

  return [rsiResult, stochasticRSIResult[stochasticRSIResult.length - 1]];
}
