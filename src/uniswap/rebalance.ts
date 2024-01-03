import { BigNumber, Contract, ethers } from "ethers";
import { DexWallet } from "../dexWallet";
import { callContractMethod } from "../contractUtils";
import { waitForTx } from "../networkUtils";
import erc20Abi from "./contracts/ERC20.json";
import quoterAbi from "./contracts/Quoter.json";
import swapRouterAbi from "./contracts/SwapRouter.json";
import { formatEther, parseEther } from "ethers/lib/utils";
import {
  LIMIT,
  ROUTER,
  QUOTER,
  SLIPPAGE,
  RSI_PERIOD,
  RSI_OVERBOUGHT,
  RSI_OVERSOLD,
  STOCKRSI_OVERBOUGHT,
  STOCKRSI_OVERSOLD,
  STOCKRSI_PERIOD,
  TECNICAL_ANALYSIS,
  WNATIVE,
  USDC,
} from "../config";
import { fetchPrices } from "./quote1Inch";
import { rechargeFees } from "./rechargeFees";
import { PrettyConsole } from "../utils/prettyConsole";
import { quotePair } from "./quote";
import { getTokenMetadata } from "./getTokenMetadata";
import { getTokenBalance } from "./getTokenBalance";

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
  const tokenAAddressForWNATIVE = reverse ? USDC : WNATIVE;
  const tokenBAddressForWNATIVE = reverse ? WNATIVE : USDC;
  const tokenBContractForWNATIVE = new Contract(
    tokenBAddressForWNATIVE,
    erc20Abi,
    wallet
  );
  const tokenAContractForWNATIVE = new Contract(
    tokenAAddressForWNATIVE,
    erc20Abi,
    wallet
  );
  const tokenANameForWNATIVE = await tokenAContractForWNATIVE.symbol();
  const tokenBNameForWNATIVE = await tokenBContractForWNATIVE.symbol();
  const tokenAAddressForUSDC = reverse ? USDC : pair[0];
  const tokenBAddressForUSDC = reverse ? pair[0] : USDC;
  const tokenAContractForUSDC = new Contract(
    tokenAAddressForUSDC,
    erc20Abi,
    wallet
  );
  const tokenBContractForUSDC = new Contract(
    tokenBAddressForUSDC,
    erc20Abi,
    wallet
  );
  const tokenANameForUSDC = await tokenAContractForUSDC.symbol();
  const tokenBNameForUSDC = await tokenBContractForUSDC.symbol();
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

  console.log("Finding Pool...");
  let poolFee: Number = 0;

  const quoterContract = new Contract(QUOTER, quoterAbi, wallet);
  const quote = await quotePair(tokenAAddress, tokenBAddress);

  poolFee = await getPoolFee(
    tokenAAddress,
    tokenBAddress,
    swapAmount,
    quoterContract
  );

  if (!quote) {
    prettyConsole.error("USDC Pool Not Found");

    prettyConsole.log("Using WMATIC route");

    const quote = await quotePair(
      tokenAAddressForWNATIVE,
      tokenBAddressForWNATIVE
    );

    if (!quote) {
      prettyConsole.error("WMATIC Pool Not Found");
      return false;
    }

    const quoterContract = new Contract(QUOTER, quoterAbi, wallet);
    const gasPrice: BigNumber = providerGasPrice.mul(12).div(10);

    prettyConsole.log(
      `Actual gas price: ${gasPrice.toBigInt()}`,
      `Provider gas price: ${providerGasPrice.toBigInt()}`
    );

    const {
      balance: balanceTokenBForWNATIVE,
      formatted: balanceTokenBForWNATIVEFormatted,
    } = await getTokenBalance(
      dexWallet,
      dexWallet.walletAddress,
      tokenAAddressForWNATIVE
    );

    if (balanceTokenBForWNATIVE.lt(swapAmount)) {
      await approveToken(
        tokenAContractForWNATIVE,
        swapAmount,
        swapRouterAddress,
        gasPrice,
        dexWallet
      );

      prettyConsole.log(
        `Swap ${tokenANameForWNATIVE} for ${tokenBNameForWNATIVE}`
      );

      poolFee = await getPoolFee(
        tokenAAddressForWNATIVE,
        tokenBAddressForWNATIVE,
        swapAmount,
        quoterContract
      );

      let [swapTxResponse, minimumAmountB] = await executeSwap(
        tokenAAddressForWNATIVE,
        tokenBAddressForWNATIVE,
        poolFee,
        swapAmount,
        walletAddress,
        swapRouterContract,
        quoterContract,
        gasPrice
      );

      await approveToken(
        tokenAContractForUSDC,
        minimumAmountB,
        swapRouterAddress,
        gasPrice,
        dexWallet
      );

      prettyConsole.log(`Swap ${tokenANameForUSDC} for ${tokenBNameForUSDC}`);

      poolFee = await getPoolFee(
        tokenAAddressForUSDC,
        tokenBAddressForUSDC,
        swapAmount,
        quoterContract
      );

      [swapTxResponse, minimumAmountB] = await executeSwap(
        tokenAAddressForUSDC,
        tokenBAddressForUSDC,
        Number(poolFee),
        minimumAmountB,
        walletAddress,
        swapRouterContract,
        quoterContract,
        gasPrice
      );

      return swapTxResponse;
    } else {
      let minimumAmount = await getAmountOut(
        tokenAAddressForWNATIVE,
        tokenBAddressForWNATIVE,
        500,
        swapAmount,
        quoterContract
      );

      await approveToken(
        tokenBContractForWNATIVE,
        minimumAmount,
        swapRouterAddress,
        gasPrice,
        dexWallet
      );

      prettyConsole.log(
        `Swap ${tokenBNameForWNATIVE} for ${tokenBNameForUSDC}`
      );

      let [swapTxResponse, minimumAmountB] = await executeSwap(
        tokenBAddressForWNATIVE,
        tokenBAddressForUSDC,
        3000,
        minimumAmount,
        walletAddress,
        swapRouterContract,
        quoterContract,
        gasPrice
      );

      return swapTxResponse;
    }
  }

  prettyConsole.log("Pool Found!");

  const gasPrice: BigNumber = providerGasPrice.mul(12).div(10);

  prettyConsole.log(
    `Actual gas price: ${gasPrice.toBigInt()}`,
    `Provider gas price: ${providerGasPrice.toBigInt()}`
  );

  await approveToken(
    tokenAContract,
    swapAmount,
    swapRouterAddress,
    gasPrice,
    dexWallet
  );

  prettyConsole.log(`Swap ${tokenAName} for ${tokenBName}`);

  const [swapTxResponse, minimumAmountB] = await executeSwap(
    tokenAAddress,
    tokenBAddress,
    Number(poolFee),
    swapAmount,
    walletAddress,
    swapRouterContract,
    quoterContract,
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

  const { balance: usdBalance, formatted: usdBalanceFormatted } =
    await getTokenBalance(dexWallet, dexWallet.walletAddress, usdcAddress);

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
    const tokenMetadata = await getTokenMetadata(token, dexWallet);
    const { balance: tokenBalance, formatted: tokenBalanceFormatted } =
      await getTokenBalance(dexWallet, dexWallet.walletAddress, token);
    const decimals = tokenMetadata.decimals;
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
    const tokenMetadata = await getTokenMetadata(token, dexWallet);
    const { balance: tokenBalance, formatted: tokenBalanceFormatted } =
      await getTokenBalance(dexWallet, dexWallet.walletAddress, token);
    const tokenSymbol = tokenMetadata.symbol;

    const valueToRebalance = totalPortfolioValue
      .mul(BigNumber.from(Math.abs(difference)))
      .div(10000); // USDT value to rebalance

    /* const decimals = tokenMetadata.decimals;
    const tokenBalanceFormatted =
      decimals == 8
        ? formatEther(String(Number(tokenBalance) * 1e10))
        : formatEther(tokenBalance); */

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
      const tokenMetadata = await getTokenMetadata(token, dexWallet);
      const decimals = tokenMetadata.decimals;
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
    if (
      stochasticRSIResult.stochRSI > STOCKRSI_OVERBOUGHT &&
      rsiResult.rsiVal > RSI_OVERBOUGHT &&
      TECNICAL_ANALYSIS
    ) {
      // Call swapCustom or equivalent function to sell the token
      // Assume that the swapCustom function takes in the token addresses, direction, and amount in token units
      await swapCustom(dexWallet, [token, usdcAddress], false, amount); // true for reverse because we're selling
      await new Promise((resolve) => setTimeout(resolve, 10000));
    } else if (!TECNICAL_ANALYSIS) {
      await swapCustom(dexWallet, [token, usdcAddress], false, amount); // true for reverse because we're selling
      await new Promise((resolve) => setTimeout(resolve, 10000));
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

    const { balance: usdBalance, formatted: usdBalanceFormatted } =
      await getTokenBalance(dexWallet, dexWallet.walletAddress, usdcAddress);

    prettyConsole.info(
      `Amount to Swap ${Number(amount)}`,
      `Usd Balance ${Number(usdBalance)}`
    );

    if (
      stochasticRSIResult.stochRSI < STOCKRSI_OVERSOLD &&
      rsiResult.rsiVal < RSI_OVERSOLD &&
      TECNICAL_ANALYSIS
    ) {
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
    } else if (!TECNICAL_ANALYSIS) {
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

async function approveToken(
  tokenContract: Contract,
  swapAmount: BigNumber,
  to: string,
  gasPrice: BigNumber,
  dexWallet: DexWallet
) {
  let allowance: BigNumber = await tokenContract.allowance(
    dexWallet.walletAddress,
    to
  );

  if (allowance.lt(swapAmount)) {
    prettyConsole.log("Approving spending of token A for swap");
    const approvalResult = await callContractMethod(
      tokenContract,
      "approve",
      [to, swapAmount],
      gasPrice
    );

    const broadcasted = await waitForTx(
      dexWallet.wallet.provider,
      approvalResult.hash
    );

    if (!broadcasted) {
      throw new Error(`TX broadcast timeout for ${approvalResult.hash}`);
    } else {
      prettyConsole.success(`Spending of ${swapAmount.toString()} approved.`);
    }
  }
}

async function executeSwap(
  tokenA: string,
  tokenB: string,
  poolFee: Number,
  swapAmount: BigNumber,
  walletAddress: string,
  swapRouterContract: Contract,
  quoterContract: Contract,
  gasPrice: BigNumber
) {
  let swapDeadline = Math.floor(Date.now() / 1000 + 60 * 60); // 1 hour from now

  let minimumAmountB = await getAmountOut(
    tokenA,
    tokenB,
    poolFee,
    swapAmount,
    quoterContract
  );

  let swapTxInputs = [
    tokenA,
    tokenB,
    BigNumber.from(3000),
    walletAddress,
    BigNumber.from(swapDeadline),
    swapAmount,
    minimumAmountB, // BigNumber.from(0),
    BigNumber.from(0),
  ];

  let swapTxResponse = await callContractMethod(
    swapRouterContract,
    "exactInputSingle",
    [swapTxInputs],
    gasPrice
  );

  return [swapTxResponse, minimumAmountB];
}

async function getAmountOut(
  tokenA: string,
  tokenB: string,
  poolFee: Number,
  swapAmount: BigNumber,
  quoterContract: Contract
) {
  try {
    let slippageTolerance = SLIPPAGE;

    let expectedAmountB = await quoterContract.callStatic.quoteExactInputSingle(
      tokenA,
      tokenB,
      poolFee,
      swapAmount.toString(),
      0
    );

    prettyConsole.log(
      `Amount A: ${swapAmount.toString()}`,
      `Expected amount B: ${expectedAmountB.toString()}`
    );

    let minimumAmountB = expectedAmountB
      .mul(10000 - slippageTolerance)
      .div(10000);

    return minimumAmountB;
  } catch (e) {
    return false;
  }
}

async function getPoolFee(
  tokenAAddress: string,
  tokenBAddress: string,
  swapAmount: BigNumber,
  quoterContract: Contract
): Promise<number> {
  const poolFees = [500, 3000, 10000];
  let poolFee = 0;
  for (const _poolFee of poolFees) {
    let poolExist = await getAmountOut(
      tokenAAddress,
      tokenBAddress,
      _poolFee,
      swapAmount,
      quoterContract
    );

    if (poolExist) {
      poolFee = _poolFee;
    }
  }

  return poolFee;
}
