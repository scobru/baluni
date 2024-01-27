import { BigNumber, Contract, ethers } from "ethers";
import { DexWallet } from "../utils/dexWallet";
import { callContractMethod } from "../utils/contractUtils";
import { waitForTx } from "../utils/networkUtils";
import erc20Abi from "../abis/ERC20.json";
import quoterAbi from "../abis/Quoter.json";
import swapRouterAbi from "../abis/SwapRouter.json";
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
  YEARN_ENABLED,
  YEARN_VAULTS,
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
import { PrettyConsole, loadPrettyConsole } from "../utils/prettyConsole";
import {
  depositToYearn,
  redeemFromYearn,
  accuredYearnInterest,
  previewWithdraw,
  getVaultAsset,
} from "../yearn/interact";

const pc = loadPrettyConsole();

async function initializeSwap(
  dexWallet: DexWallet,
  pair: [string, string],
  reverse?: boolean
) {
  const { wallet, walletAddress, providerGasPrice, walletProvider } = dexWallet;
  const chainId = walletProvider.network.chainId;
  const tokenAAddress = reverse ? pair[1] : pair[0];
  const tokenBAddress = reverse ? pair[0] : pair[1];
  const tokenAContract = new Contract(tokenAAddress, erc20Abi, wallet);
  const tokenBContract = new Contract(tokenBAddress, erc20Abi, wallet);
  const tokenAName = await tokenAContract.symbol();
  const tokenBName = await tokenBContract.symbol();
  const swapRouterAddress = ROUTER[chainId];
  const swapRouterContract = new Contract(
    swapRouterAddress,
    swapRouterAbi,
    wallet
  );
  return {
    tokenAAddress,
    tokenBAddress,
    tokenAContract,
    tokenBContract,
    tokenAName,
    tokenBName,
    swapRouterAddress,
    swapRouterContract,
    providerGasPrice,
    walletAddress,
  };
}

async function findPoolAndFee(
  quoterContract: Contract,
  tokenAAddress: string,
  tokenBAddress: string,
  swapAmount: BigNumber
) {
  pc.log("Finding Pool...");

  let poolFee: Number = 0;

  poolFee = await getPoolFee(
    tokenAAddress,
    tokenBAddress,
    swapAmount,
    quoterContract
  );

  return poolFee;
}

export async function swapCustom(
  dexWallet: DexWallet,
  pair: [string, string],
  reverse?: boolean,
  swapAmount?: BigNumber
) {
  if (!swapAmount || swapAmount.isZero()) {
    pc.error("Swap amount must be a positive number.");
    return;
  }
  const {
    tokenAAddress,
    tokenBAddress,
    tokenAContract,
    tokenBContract,
    tokenAName,
    tokenBName,
    swapRouterAddress,
    swapRouterContract,
    providerGasPrice,
    walletAddress,
  } = await initializeSwap(dexWallet, pair, reverse);
  const provider = dexWallet.walletProvider;
  const chainId = provider.network.chainId;
  const gasPrice = providerGasPrice.mul(12).div(10);
  const quoterContract = new Contract(
    QUOTER[chainId],
    quoterAbi,
    dexWallet.wallet
  );
  const quote = await quotePair(tokenAAddress, tokenBAddress);

  pc.log(
    `⛽ Actual gas price: ${gasPrice.toBigInt()}`,
    `💲 Provider gas price: ${providerGasPrice.toBigInt()}`
  );

  if (!quote) {
    pc.error("❌ USDC Pool Not Found");
    pc.log("↩️ Using WMATIC route");
    await approveToken(
      tokenAContract,
      swapAmount,
      swapRouterAddress,
      gasPrice,
      dexWallet
    );

    const poolFee = await findPoolAndFee(
      quoterContract,
      tokenAAddress,
      WNATIVE[chainId],
      swapAmount
    );

    const poolFee2 = await findPoolAndFee(
      quoterContract,
      WNATIVE[chainId],
      USDC[chainId],
      swapAmount
    );

    const [swapTxResponse, minimumAmountB] = await executeMultiHopSwap(
      tokenAAddress,
      WNATIVE[chainId],
      tokenBAddress,
      poolFee,
      poolFee2,
      swapAmount,
      walletAddress,
      swapRouterContract,
      quoterContract,
      gasPrice,
      dexWallet.walletProvider as ethers.providers.JsonRpcProvider
    );
    let broadcasted = await waitForTx(
      dexWallet.wallet.provider,
      swapTxResponse.hash
    );

    if (!broadcasted)
      throw new Error(`TX broadcast timeout for ${swapTxResponse.hash}`);
    pc.success(`Transaction Complete!`);
    return swapTxResponse;
  }

  pc.log("🎉 Pool Found!");
  await approveToken(
    tokenAContract,
    swapAmount,
    swapRouterAddress,
    gasPrice,
    dexWallet
  );
  pc.log(`↔️ Swap ${tokenAName} for ${tokenBName})}`);

  const poolFee = await findPoolAndFee(
    quoterContract,
    tokenAAddress,
    tokenBAddress,
    swapAmount
  );

  const [swapTxResponse, minimumAmountB] = await executeSwap(
    tokenAAddress,
    tokenBAddress,
    Number(poolFee),
    swapAmount,
    walletAddress,
    swapRouterContract,
    quoterContract,
    gasPrice,
    dexWallet.walletProvider as ethers.providers.JsonRpcProvider
  );

  let broadcasted = await waitForTx(
    dexWallet.wallet.provider,
    swapTxResponse.hash
  );
  if (!broadcasted)
    throw new Error(`TX broadcast timeout for ${swapTxResponse.hash}`);
  pc.success(`Transaction Complete!`);

  return swapTxResponse;
}

export async function rebalancePortfolio(
  dexWallet: DexWallet,
  desiredTokens: string[],
  desiredAllocations: { [token: string]: number },
  usdcAddress: string
) {
  pc.log(
    "**************************************************************************"
  );
  pc.log("⚖️  Rebalance Portfolio\n", "🔋 Check Gas and Recharge\n");

  // Recharge Fees
  await rechargeFees(dexWallet);
  const chainId = dexWallet.walletProvider.network.chainId;

  const _usdBalance = await getTokenBalance(
    dexWallet.walletProvider,
    dexWallet.walletAddress,
    usdcAddress
  );
  let usdBalance = _usdBalance.balance;

  //let totalPortfolioValue = BigNumber.from(usdBalance.mul(1e12).toString());
  let totalPortfolioValue = BigNumber.from(0);

  pc.log(
    "🏦 Total Portfolio Value (in USDT) at Start: ",
    formatEther(totalPortfolioValue)
  );

  let tokenValues: { [token: string]: BigNumber } = {};

  // First, calculate the current value of each token in the portfolio
  for (const token of desiredTokens) {
    let tokenValue;
    const tokenContract = new ethers.Contract(
      token,
      erc20Abi,
      dexWallet.wallet
    );
    const tokenMetadata = await getTokenMetadata(
      token,
      dexWallet.walletProvider
    );
    const _tokenbalance = await getTokenBalance(
      dexWallet.walletProvider,
      dexWallet.walletAddress,
      token
    );
    const tokenBalance = _tokenbalance.balance;
    const decimals = tokenMetadata.decimals;
    const tokenSymbol = await tokenContract.symbol();
    const yearnVaultDetails = YEARN_VAULTS[chainId][tokenSymbol];
    if (yearnVaultDetails) {
      const yearnContract = new ethers.Contract(
        yearnVaultDetails,
        erc20Abi,
        dexWallet.wallet
      );
      const yearnBalance = await yearnContract?.balanceOf(
        dexWallet.walletAddress
      );
      const interestAccrued = await accuredYearnInterest(
        yearnVaultDetails,
        dexWallet
      );
      tokenValue = await getTokenValueEnhanced(
        tokenSymbol,
        token,
        tokenBalance,
        decimals,
        usdcAddress,
        yearnBalance,
        interestAccrued,
        dexWallet.walletProvider.network.chainId
      );

      tokenValues[token] = tokenValue;
    } else {
      // Handle tokens without Yearn Vault
      tokenValue = await getTokenValue(
        tokenSymbol,
        token,
        tokenBalance,
        decimals,
        USDC[chainId],
        dexWallet.walletProvider.network.chainId
      );
    }
    tokenValues[token] = tokenValue;
    totalPortfolioValue = totalPortfolioValue.add(tokenValue);
  }

  pc.log(
    "🏦 Total Portfolio Value (in USDT): ",
    formatEther(totalPortfolioValue)
  );

  // Calculate the current allocations
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

  const REDEEM_PERCENTAGE = 6000;
  const TOTAL_PERCENTAGE = 10000;

  // Find token to sell and buy
  for (const token of desiredTokens) {
    const currentAllocation = currentAllocations[token]; // current allocation as percentage
    const desiredAllocation = desiredAllocations[token];
    const difference = desiredAllocation - currentAllocation; // Calculate the difference for each token
    const tokenMetadata = await getTokenMetadata(
      token,
      dexWallet.walletProvider
    );
    const _tokenBalance = await getTokenBalance(
      dexWallet.walletProvider,
      dexWallet.walletAddress,
      token
    );
    let tokenBalance = _tokenBalance.balance;
    const tokenSymbol: string = tokenMetadata.symbol as string;
    const yearnVaultDetails = YEARN_VAULTS[chainId][tokenSymbol];
    if (yearnVaultDetails) {
      const yearnContract = new ethers.Contract(
        yearnVaultDetails,
        erc20Abi,
        dexWallet.wallet
      );
      const yearnBalance = await yearnContract?.balanceOf(
        dexWallet.walletAddress
      );
      tokenBalance = _tokenBalance.balance.add(yearnBalance);
    }

    const valueToRebalance = totalPortfolioValue
      .mul(BigNumber.from(Math.abs(difference)))
      .div(10000); // USDT value to rebalance

    pc.log(
      `🪙  Token: ${token}`,
      `📊 Current Allocation: ${currentAllocation}%`,
      `💰 Difference: ${difference}%`,
      `💲 Value (USD): ${formatEther(tokenValues[token])}`,
      `⚖️  Value to Rebalance (USD): ${formatEther(valueToRebalance)}`,
      `👛 Balance: ${formatEther(tokenBalance)} ${tokenSymbol}`
    );

    if (difference < 0 && Math.abs(difference) > LIMIT) {
      // Calculate token amount to sell
      //const tokenPriceInUSDT = await quotePair(token, usdcAddress);
      const tokenMetadata = await getTokenMetadata(
        token,
        dexWallet.walletProvider
      );
      const decimals = tokenMetadata.decimals;
      const _token = {
        address: token,
        decimals: decimals,
      };

      const tokenPriceInUSDT: any = await fetchPrices(
        _token,
        dexWallet.walletProvider.network.chainId
      ); // Ensure this returns a value
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

  // Sell Tokens
  for (let { token, amount } of tokensToSell) {
    if (token === usdcAddress) {
      pc.log("SKIP USDC SELL");
      break;
    }

    pc.info(`🔴 Selling ${formatEther(amount)} worth of ${token}`);

    const tokenContract = new Contract(token, erc20Abi, dexWallet.wallet);
    const tokenSymbol = await tokenContract.symbol();

    const handleTokenRedemption = async (
      tokenBalance: { lt: (arg0: BigNumber) => any },
      yearnBalance: { gte: (arg0: BigNumber) => any },
      dexWallet: DexWallet,
      yearnContract: string
    ) => {
      const REDEEM_PERCENTAGE = 6000;
      const TOTAL_PERCENTAGE = 10000;
      const reducedAmount = amount.mul(REDEEM_PERCENTAGE).div(TOTAL_PERCENTAGE);
      const chainId = dexWallet.walletProvider.network.chainId;

      if (tokenBalance.lt(amount) && yearnBalance.gte(amount)) {
        await redeemFromYearn(yearnContract, amount, dexWallet);
      } else if (yearnBalance.gte(reducedAmount)) {
        await redeemFromYearn(yearnContract, reducedAmount, dexWallet);
        amount = reducedAmount;
      }
      return amount;
    };
    const yearnVaultDetails = YEARN_VAULTS[chainId][tokenSymbol];

    if (yearnVaultDetails) {
      const balance = await getTokenBalance(
        dexWallet.walletProvider,
        dexWallet.walletAddress,
        token
      );
      const yearnContract = new ethers.Contract(
        yearnVaultDetails,
        erc20Abi,
        dexWallet.wallet
      );
      const yearnBalance = await yearnContract?.balanceOf(
        dexWallet.walletAddress
      );
      amount = await handleTokenRedemption(
        balance.balance,
        yearnBalance,
        dexWallet,
        yearnVaultDetails
      );
    }

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
      pc.warn("⚠️ Waiting for StochRSI overBought");
    }
  }

  // Buy Tokens
  for (let { token, amount } of tokensToBuy) {
    if (token === usdcAddress) {
      pc.log("SKIP USDC BUY");
      break;
    }

    pc.info(`🟩 Buying ${Number(amount) / 1e6} USDC worth of ${token}`);

    const tokenContract = new Contract(token, erc20Abi, dexWallet.wallet);
    const tokenSymbol = await tokenContract.symbol();
    const [rsiResult, stochasticRSIResult] = await getRSI(tokenSymbol);

    // Call swapCustom or equivalent function to buy the token
    // Here we're assuming that swapCustom is flexible enough to handle both buying and selling
    const reducedAmount = amount.mul(REDEEM_PERCENTAGE).div(TOTAL_PERCENTAGE);

    const _usdBalance = await getTokenBalance(
      dexWallet.walletProvider,
      dexWallet.walletAddress,
      USDC[chainId]
    );
    usdBalance = _usdBalance.balance;

    const yearnVaultDetails = YEARN_VAULTS[chainId].USDC;
    const yearnContract = new ethers.Contract(
      yearnVaultDetails,
      erc20Abi,
      dexWallet.wallet
    );
    const balanceYearnUSDC = await yearnContract?.balanceOf(
      dexWallet.walletAddress
    );

    if (usdBalance.lt(amount) && balanceYearnUSDC.gte(amount)) {
      await redeemFromYearn(yearnVaultDetails, amount, dexWallet);
    } else if (usdBalance.gte(reducedAmount)) {
      amount = reducedAmount;
    } else if (balanceYearnUSDC.gte(reducedAmount)) {
      await redeemFromYearn(yearnVaultDetails, reducedAmount, dexWallet);
      amount = reducedAmount;
    }

    const isTechnicalAnalysisConditionMet =
      stochasticRSIResult.stochRSI < STOCKRSI_OVERSOLD &&
      rsiResult.rsiVal < RSI_OVERSOLD;

    // Check if either technical analysis condition is met or if technical analysis is disabled
    if (isTechnicalAnalysisConditionMet || !TECNICAL_ANALYSIS) {
      if (usdBalance.gte(amount)) {
        await swapCustom(dexWallet, [token, usdcAddress], true, amount);
        await new Promise((resolve) => setTimeout(resolve, 5000));
      } else if (usdBalance.lt(amount) && usdBalance.gte(reducedAmount)) {
        pc.log("Use all USDT to buy");
        await swapCustom(dexWallet, [token, usdcAddress], true, usdBalance);
      } else {
        pc.error(
          "✖️ Not enough USDT to buy, balance under 60% of required USD"
        );
      }
    } else {
      pc.warn("Waiting for StochRSI OverSold");
    }
  }

  for (const vault of Object.values(YEARN_VAULTS[chainId])) {
    const vaultAsset = await getVaultAsset(vault, dexWallet);
    const assetContract = new ethers.Contract(
      vaultAsset,
      erc20Abi,
      dexWallet.wallet
    );
    const balance = await assetContract.balanceOf(dexWallet.walletAddress);
    if (balance.gt(0)) {
      if (tokensToBuy.length == 0 && tokensToSell.length == 0) {
        await depositToYearn(
          vaultAsset,
          vault, // Qui è stato corretto
          balance,
          dexWallet
        );
      }
    }
  }

  pc.success("✔️ Rebalance completed.");
}

async function executeSwap(
  tokenA: string,
  tokenB: string,
  poolFee: Number,
  swapAmount: BigNumber,
  walletAddress: string,
  swapRouterContract: Contract,
  quoterContract: Contract,
  gasPrice: BigNumber,
  provider: ethers.providers.JsonRpcProvider
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
    minimumAmountB,
    BigNumber.from(0),
  ];

  let swapTxResponse = await callContractMethod(
    swapRouterContract,
    "exactInputSingle",
    [swapTxInputs],
    provider,
    gasPrice,
    BigNumber.from(0)
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
  gasPrice: BigNumber,
  provider: ethers.providers.JsonRpcProvider
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
    provider,
    gasPrice,
    BigNumber.from(0)
  );

  return [swapTxResponse, minimumAmountB2];
}

async function getTokenValueEnhanced(
  tokenSymbol: string,
  token: string,
  tokenBalance: BigNumber,
  decimals: number,
  usdcAddress: string,
  yearnBalance?: BigNumber,
  interestAccrued?: any,
  chainId?: number
) {
  let effectiveBalance = tokenBalance;
  if (YEARN_ENABLED && yearnBalance) {
    effectiveBalance = yearnBalance.add(interestAccrued).add(tokenBalance);
  }
  return tokenSymbol === "USDC"
    ? effectiveBalance.mul(1e12)
    : await getTokenValue(
        tokenSymbol,
        token,
        effectiveBalance,
        decimals,
        usdcAddress,
        chainId as number
      );
}
