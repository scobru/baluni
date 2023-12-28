import { BigNumber, Contract, ethers } from "ethers";
import { DexWallet } from "../dexWallet";
import { callContractMethod, simulateContractMethod } from "../contractUtils";
import { waitForTx } from "../networkUtils";
import erc20Abi from "./contracts/ERC20.json";
import swapRouterAbi from "./contracts/SwapRouter.json";
import { formatEther } from "ethers/lib/utils";
import { LIMIT, ROUTER } from "../config";
import { fetchPrices } from "./quote1Inch";
import { POLYGON } from "../networks";
import { rechargeFees } from "./rechargeFees";
import { rsiCheck, getDetachSourceFromOHLCV } from "trading-indicator";

export async function swapCustom(
  dexWallet: DexWallet,
  pair: [string, string],
  reverse?: boolean,
  swapAmount?: BigNumber
) {
  if (!swapAmount || swapAmount.isZero()) {
    console.error("Swap amount must be a positive number.");
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
  console.log("Provider gas price:", providerGasPrice.toBigInt());
  const gasPrice: BigNumber = providerGasPrice.mul(15).div(10);

  console.log("  Actual gas price:", gasPrice.toBigInt());
  const allowance: BigNumber = await tokenAContract.allowance(
    walletAddress,
    swapRouterAddress
  );
  console.log("Token A spenditure allowance:", allowance.toBigInt());

  if (allowance.lt(swapAmount)) {
    console.log("Approving spending of token A for swap");
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
      console.log(`Spending of ${swapAmount.toString()} approved.`);
    }
  }

  console.log("Swap", tokenAName, "for", tokenBName);

  const swapDeadline = Math.floor(Date.now() / 1000 + 60 * 60); // 1 hour from now
  const swapTxInputs = [
    tokenAAddress,
    tokenBAddress,
    BigNumber.from(3000),
    walletAddress,
    BigNumber.from(swapDeadline),
    swapAmount,
    BigNumber.from(0),
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
  console.log(
    "**************************************************************************"
  );
  console.log("Rebalance Portfolio");

  console.log("Check Gas and Recharge");
  await rechargeFees();

  const usdContract = new Contract(usdcAddress, erc20Abi, dexWallet.wallet);
  const usdBalance = await usdContract?.balanceOf(dexWallet.walletAddress);

  // Check Rsi before invest USD
  const { input } = await getDetachSourceFromOHLCV(
    "binance",
    "BTC/USDT",
    "5m",
    false
  ); // true if you want to get future market
  const rsiResult = await rsiCheck(14, 75, 25, input);

  let totalPortfolioValue =
    rsiResult.overSold == true
      ? BigNumber.from(usdBalance.mul(1e12).toString())
      : BigNumber.from(0);

  console.log(
    "Total Portfolio Value (in USDT) at Start:",
    formatEther(totalPortfolioValue)
  );
  //let totalPortfolioValue =BigNumber.from(0);

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
    const tokenValue = await getTokenValue(
      tokenSymbol,
      token,
      tokenBalance,
      decimals,
      usdcAddress,
      dexWallet.wallet
    );
    tokenValues[token] = tokenValue;
    totalPortfolioValue = totalPortfolioValue.add(tokenValue);
  }

  console.log(
    "Total Portfolio Value (in USDT):",
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

    console.group(`Token Details:`);
    console.log(`Token: ${token}`);
    console.log(`Current Allocation: ${currentAllocation}%`);
    console.log(`Desired Allocation: ${desiredAllocation}%`);
    console.log(`Difference: ${difference}%`);
    console.log(`Value (USD): ${formatEther(tokenValues[token])}`);
    console.log(`Value to Rebalance (USD): ${formatEther(valueToRebalance)}`);
    console.log(`Balance: ${tokenBalanceFormatted} ${tokenSymbol}`);
    console.groupEnd();

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
    console.log(`Selling ${formatEther(amount)} worth of ${token}`);
    // Call swapCustom or equivalent function to sell the token
    // Assume that the swapCustom function takes in the token addresses, direction, and amount in token units
    await swapCustom(dexWallet, [token, usdcAddress], false, amount); // true for reverse because we're selling
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }

  // Execute purchases next
  for (let { token, amount } of tokensToBuy) {
    // Call swapCustom or equivalent function to buy the token
    // Here we're assuming that swapCustom is flexible enough to handle both buying and selling
    const usdContract = new Contract(usdcAddress, erc20Abi, dexWallet.wallet);
    const usdBalance = await usdContract?.balanceOf(dexWallet.walletAddress);
    console.log("Amount to Swap", Number(amount));
    console.log("Usd Balance", Number(usdBalance));

    if (Number(usdBalance) > Number(amount)) {
      console.log(`Buying ${formatEther(amount)} worth of ${token}`);
      await swapCustom(dexWallet, [token, usdcAddress], true, amount); // false for reverse because we're buying
      // wait 5 seconds before moving on to the next token
      await new Promise((resolve) => setTimeout(resolve, 5000));
    } else if (
      Number(usdBalance) < Number(amount) &&
      Number(usdBalance) > (Number(amount) * 6000) / 10000
    ) {
      console.log("Use all USDT to buy");
      await swapCustom(dexWallet, [token, usdcAddress], true, usdBalance);
    } else {
      console.log("Not enough USDT to buy, balance under 60% of required USD");
    }
  }

  console.log("Rebalance completed.");
  console.log(
    "**************************************************************************"
  );
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

    console.log(
      "**************************************************************************"
    );
    console.log("Token Symbol:", tokenSymbol);
    console.log("Token:", token);
    console.log(
      "Balance:",
      decimals == 8
        ? formatEther(String(Number(balance) * 1e10))
        : formatEther(balance.toString())
    );
    console.log("Price:", price?.toString());
    console.log("Value:", formatEther(value.toString()));

    return value;
  }
}
