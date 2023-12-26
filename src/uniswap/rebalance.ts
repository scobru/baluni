import { BigNumber, Contract, ethers } from "ethers";
import { DexWallet } from "../dexWallet";
import { callContractMethod } from "../contractUtils";
import { waitForTx } from "../networkUtils";
import erc20Abi from "./contracts/ERC20.json";
import swapRouterAbi from "./contracts/SwapRouter.json";
import { quotePair } from "./quote";
import { formatEther } from "ethers/lib/utils";
import { LIMIT, ROUTER, USDC } from "../config";
import { fetchPrices } from "./quote1Inch";

export async function swapUSDT(
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
  const gasPrice: BigNumber = providerGasPrice.mul(180).div(100);
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
  usdtAddress: string
) {
  console.log("Rebalance Portfolio");
  let totalPortfolioValue = BigNumber.from(0);
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
    const tokenValue = await getTokenValue(
      token,
      tokenBalance,
      decimals,
      usdtAddress,
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

    const valueToRebalance = totalPortfolioValue
      .mul(BigNumber.from(Math.abs(difference)))
      .div(10000); // USDT value to rebalance

    console.group(
      `Token: ${token} | Current Allocation: ${currentAllocation}% | Desired Allocation: ${desiredAllocation}% | Difference: ${difference}%`
    );
    console.groupEnd();

    if (difference < 0 && Math.abs(difference) > LIMIT) {
      // Calculate token amount to sell
      const tokenPriceInUSDT = await quotePair(token, usdtAddress); // Ensure this returns a value
      const pricePerToken = ethers.utils.parseUnits(
        tokenPriceInUSDT!.toString(),
        "ether"
      );
      const decimals = await getDecimals(token);
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
    // Call swapUSDT or equivalent function to sell the token
    // Assume that the swapUSDT function takes in the token addresses, direction, and amount in token units
    await swapUSDT(dexWallet, [token, usdtAddress], false, amount); // true for reverse because we're selling
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }

  // Execute purchases next
  for (let { token, amount } of tokensToBuy) {
    // Here, the amount represents the percentage of total portfolio value to purchase

    // Call swapUSDT or equivalent function to buy the token
    // Here we're assuming that swapUSDT is flexible enough to handle both buying and selling
    const usdContract = new Contract(USDC, erc20Abi, dexWallet.wallet);
    const usdBalance = await usdContract?.balanceOf(dexWallet.walletAddress);
    console.log("Amount to Swap", Number(amount));
    console.log("Usd Balance", Number(usdBalance));

    if (Number(usdBalance) > Number(amount)) {
      console.log(`Buying ${formatEther(amount)} worth of ${token}`);
      await swapUSDT(dexWallet, [token, usdtAddress], true, amount); // false for reverse because we're buying
      // wait 5 seconds before moving on to the next token
      await new Promise((resolve) => setTimeout(resolve, 5000));
    } else {
      console.log("Insufficient USD BALANCE");
    }
  }

  console.log("Rebalance completed.");
}

// Add the function to fetch token decimals if not already present.
async function getDecimals(tokenAddress: string): Promise<number> {
  const provider = new ethers.providers.JsonRpcProvider(
    "https://polygon-rpc.com/"
  );

  const tokenContract = new ethers.Contract(tokenAddress, erc20Abi, provider);
  return tokenContract.decimals();
}

async function getTokenValue(
  token: string,
  balance: BigNumber,
  decimals: number,
  usdtAddress: string,
  wallet: ethers.Wallet
): Promise<BigNumber> {
  if (token === usdtAddress) {
    return balance; // USDT value is the balance itself
  } else {
    //const price = await quotePair(token, usdtAddress);
    const _token = {
      address: token,
      decimals: decimals,
    };
    const price: any = await fetchPrices(_token);
    console.log("Price", price);
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

    console.log("Token:", token);
    console.log("Balance:", balance.toString());
    console.log("Price:", price?.toString());
    console.log("Value:", value.toString());

    return value;
  }
}
