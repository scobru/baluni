import { BigNumber, Contract, ethers } from "ethers";
import { DexWallet } from "../utils/dexWallet";
import { callContractMethod } from "../utils/contractUtils";
import { waitForTx } from "../utils/networkUtils";
import erc20Abi from "./contracts/ERC20.json";
import quoterAbi from "./contracts/Quoter.json";
import swapRouterAbi from "./contracts/SwapRouter.json";
import { formatEther } from "ethers/lib/utils";
import {
  LIMIT,
  ROUTER,
  QUOTER,
  RSI_OVERBOUGHT,
  RSI_OVERSOLD,
  STOCKRSI_OVERBOUGHT,
  STOCKRSI_OVERSOLD,
  TECNICAL_ANALYSIS,
  WNATIVE,
  USDC,
  YEARN_AAVE_V3_USDC,
  YEARN_ENABLED,
} from "../config";
import { fetchPrices } from "./quote1Inch";
import { rechargeFees } from "../utils/rechargeFees";
import { quotePair } from "./quote";
import { getTokenMetadata } from "../utils/getTokenMetadata";
import { getTokenBalance } from "../utils/getTokenBalance";
import { getAmountOut, getPoolFee } from "../utils/getPoolFee";
import { approveToken } from "../utils/approveToken";
import { getTokenValue } from "../utils/getTokenValue";
import { getRSI } from "../utils/getRSI";
import { loadPrettyConsole } from "../utils/prettyConsole";
import {
  depositToYearn,
  redeemFromYearn,
  accuredYearnInterest,
} from "../yearn/interact";

const prettyConsole = loadPrettyConsole();
let lastInterest = BigNumber.from(0);

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

  if (!quote && !reverse) {
    prettyConsole.error("USDC Pool Not Found");
    prettyConsole.log("Using WMATIC route");

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

    poolFee = await getPoolFee(
      tokenAAddress,
      WNATIVE,
      swapAmount,
      quoterContract
    );

    const poolFee2 = await getPoolFee(
      WNATIVE,
      USDC,
      swapAmount,
      quoterContract
    );

    let [swapTxResponse, minimumAmountB] = await executeMultiHopSwap(
      tokenAAddress,
      WNATIVE,
      tokenBAddress,
      poolFee,
      poolFee2,
      swapAmount,
      walletAddress,
      swapRouterContract,
      quoterContract,
      gasPrice
    );

    let broadcasted = await waitForTx(
      dexWallet.wallet.provider,
      swapTxResponse.hash
    );

    if (!broadcasted) {
      throw new Error(`TX broadcast timeout for ${swapTxResponse.hash}`);
    } else {
      prettyConsole.success(`Transaction Complete!`);
    }

    return swapTxResponse;
  } else if (!quote && reverse) {
    prettyConsole.error("USDC Pool Not Found");
    prettyConsole.log("Using WMATIC route");

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

    poolFee = await getPoolFee(
      WNATIVE,
      tokenAAddress,
      swapAmount,
      quoterContract
    );

    const poolFee2 = await getPoolFee(
      WNATIVE,
      tokenBAddress,
      swapAmount,
      quoterContract
    );

    let [swapTxResponse, minimumAmountB] = await executeMultiHopSwap(
      tokenAAddress,
      WNATIVE,
      tokenBAddress,
      poolFee,
      poolFee2,
      swapAmount,
      walletAddress,
      swapRouterContract,
      quoterContract,
      gasPrice
    );

    let broadcasted = await waitForTx(
      dexWallet.wallet.provider,
      swapTxResponse.hash
    );

    if (!broadcasted) {
      throw new Error(`TX broadcast timeout for ${swapTxResponse.hash}`);
    } else {
      prettyConsole.success(`Transaction Complete!`);
    }

    return swapTxResponse;
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

  let broadcasted = await waitForTx(
    dexWallet.wallet.provider,
    swapTxResponse.hash
  );

  if (!broadcasted) {
    throw new Error(`TX broadcast timeout for ${swapTxResponse.hash}`);
  } else {
    prettyConsole.success(`Transaction Complete!`);
  }

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

  const yearnContract = new ethers.Contract(
    YEARN_AAVE_V3_USDC,
    erc20Abi,
    dexWallet.wallet
  );

  const balanceYearn = await yearnContract?.balanceOf(dexWallet.walletAddress);
  prettyConsole.log("YEARN BALANCE", balanceYearn.mul(1e12).toString());

  const interestAccrued = await accuredYearnInterest(dexWallet);
  const differenceInterest = interestAccrued.sub(lastInterest);

  prettyConsole.log(
    "Difference Interest from last cycle",
    formatEther(differenceInterest.mul(1e12))
  );

  lastInterest = interestAccrued;

  if (interestAccrued.gt(1e6)) {
    // withdraw from yearn
    await redeemFromYearn(interestAccrued, dexWallet);
  }

  if (balanceYearn.gt(0)) {
    totalPortfolioValue = totalPortfolioValue.add(
      balanceYearn.add(usdBalance).mul(1e12)
    );
  }

  if (usdBalance.gt(0)) {
    await depositToYearn(usdBalance, dexWallet);
  }

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
      if (!YEARN_ENABLED) {
        tokenValue = BigNumber.from(tokenBalance.toString()).mul(1e12);
      } else {
        tokenValue = BigNumber.from(
          balanceYearn.add(interestAccrued).add(tokenBalance).mul(1e12)
        );
      }
    } else {
      tokenValue = await getTokenValue(
        tokenSymbol,
        token,
        tokenBalance,
        decimals,
        usdcAddress
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
    const tokenMetadata = await getTokenMetadata(token, dexWallet);
    const { balance: tokenBalance, formatted: tokenBalanceFormatted } =
      await getTokenBalance(dexWallet, dexWallet.walletAddress, token);
    const tokenSymbol = tokenMetadata.symbol;

    const valueToRebalance = totalPortfolioValue
      .mul(BigNumber.from(Math.abs(difference)))
      .div(10000); // USDT value to rebalance

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
      prettyConsole.log("SKIPP USDC SELL");
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

  let _usdBalance: { balance: BigNumber; formatted: string } = {
    balance: BigNumber.from(0),
    formatted: "",
  };

  // Execute purchases next
  for (let { token, amount } of tokensToBuy) {
    if (token === usdcAddress) {
      prettyConsole.log("SKIP USDC BUY");

      break;
    }

    prettyConsole.assert(
      `Buying ${Number(amount) / 1e6} USDC worth of ${token}`
    );

    if (_usdBalance.balance.lt(amount))
      await redeemFromYearn(amount, dexWallet);

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

async function executeMultiHopSwap(
  tokenA: string,
  tokenB: string,
  tokenC: string,
  poolFee: Number,
  poolFee2: Number,
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

  let minimumAmountB2 = await getAmountOut(
    tokenB,
    tokenC,
    poolFee2,
    minimumAmountB,
    quoterContract
  );

  // use encodePakced
  const path = ethers.utils.solidityPack(
    ["address", "uint24", "address", "uint24", "address"],
    [tokenA, poolFee, tokenB, poolFee2, tokenC]
  );

  let swapTxInputs = [
    path,
    walletAddress,
    BigNumber.from(swapDeadline),
    swapAmount,
    0, // BigNumber.from(0),
  ];

  let swapTxResponse = await callContractMethod(
    swapRouterContract,
    "exactInput",
    [swapTxInputs],
    gasPrice
  );

  return [swapTxResponse, minimumAmountB2];
}
