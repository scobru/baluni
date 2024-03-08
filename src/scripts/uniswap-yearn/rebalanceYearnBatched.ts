import { BigNumber, Contract, ethers } from "ethers";
import { DexWallet } from "../../utils/dexWallet";
import { callContractMethod } from "../../utils/contractUtils";
import { waitForTx } from "../../utils/networkUtils";
import erc20Abi from "../../abis/common/ERC20.json";

import { formatEther, formatUnits } from "ethers/lib/utils";
import { fetchPrices } from "../../protocols/1inch/quote1Inch";
import { rechargeFees } from "../../utils/rechargeFees";
import { getTokenMetadata } from "../../utils/getTokenMetadata";
import { getTokenBalance } from "../../utils/getTokenBalance";
import { getAmountOut, getPoolFee } from "../../utils/getPoolFee";
import { getTokenValue } from "../../utils/getTokenValue";
import { getRSI } from "../../utils/getRSI";
import { loadPrettyConsole } from "../../utils/prettyConsole";
import {
  depositToYearn,
  redeemFromYearn,
  accuredYearnInterest,
  previewWithdraw,
  getVaultAsset,
} from "../../protocols/yearn/interact";
import { batchSwap, swap } from "../uniswap/swap";

const pc = loadPrettyConsole();

let config: any;

/* async function initializeSwap(dexWallet: DexWallet, pair: [string, string], reverse?: boolean) {
  const { wallet, walletAddress, providerGasPrice, walletProvider } = dexWallet;
  const chainId = walletProvider.network.chainId;
  const tokenAAddress = reverse ? pair[1] : pair[0];
  const tokenBAddress = reverse ? pair[0] : pair[1];
  const tokenAContract = new Contract(tokenAAddress, erc20Abi, wallet);
  const tokenBContract = new Contract(tokenBAddress, erc20Abi, wallet);
  const tokenAName = await tokenAContract.symbol();
  const tokenBName = await tokenBContract.symbol();
  const swapRouterAddress = config?.ROUTER;
  const swapRouterContract = new Contract(swapRouterAddress, swapRouterAbi, wallet);
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
} */

/* export async function swapCustom(
  dexWallet: DexWallet,
  pair: [string, string],
  reverse?: boolean,
  swapAmount?: BigNumber,
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
  const quoterContract = new Contract(config?.QUOTER, quoterAbi, dexWallet.wallet);
  const quote = await quotePair(tokenAAddress, tokenBAddress);

  pc.log(`⛽ Actual gas price: ${gasPrice.toBigInt()}`, `💲 Provider gas price: ${providerGasPrice.toBigInt()}`);

  if (!quote) {
    pc.error("❌ USDC Pool Not Found");
    pc.log("↩️ Using WMATIC route");
    await approveToken(tokenAContract, swapAmount, swapRouterAddress, gasPrice, dexWallet, config);

    const poolFee = await findPoolAndFee(quoterContract, tokenAAddress, config?.WRAPPED, swapAmount);

    const poolFee2 = await findPoolAndFee(quoterContract, config?.WRAPPED, config?.USDC, swapAmount);

    const [swapTxResponse, minimumAmountB] = await executeMultiHopSwap(
      tokenAAddress,
      config?.WRAPPED,
      tokenBAddress,
      poolFee,
      poolFee2,
      swapAmount,
      walletAddress,
      swapRouterContract,
      quoterContract,
      gasPrice,
      dexWallet.walletProvider as ethers.providers.JsonRpcProvider,
    );
    let broadcasted = await waitForTx(dexWallet.wallet.provider, swapTxResponse.hash);

    if (!broadcasted) throw new Error(`TX broadcast timeout for ${swapTxResponse.hash}`);
    pc.success(`Transaction Complete!`);
    return swapTxResponse;
  }

  pc.log("🎉 Pool Found!");
  await approveToken(tokenAContract, swapAmount, swapRouterAddress, gasPrice, dexWallet, config);
  pc.log(`↔️ Swap ${tokenAName} for ${tokenBName})}`);

  const poolFee = await findPoolAndFee(quoterContract, tokenAAddress, tokenBAddress, swapAmount);

  const [swapTxResponse, minimumAmountB] = await executeSwap(
    tokenAAddress,
    tokenBAddress,
    Number(poolFee),
    swapAmount,
    walletAddress,
    swapRouterContract,
    quoterContract,
    gasPrice,
    dexWallet.walletProvider as ethers.providers.JsonRpcProvider,
  );

  let broadcasted = await waitForTx(dexWallet.wallet.provider, swapTxResponse.hash);
  if (!broadcasted) throw new Error(`TX broadcast timeout for ${swapTxResponse.hash}`);
  pc.success(`Transaction Complete!`);

  return swapTxResponse;
} */

async function findPoolAndFee(
  quoterContract: Contract,
  tokenAAddress: string,
  tokenBAddress: string,
  swapAmount: BigNumber,
) {
  pc.log("Finding Pool...");

  let poolFee: Number = 0;

  poolFee = await getPoolFee(tokenAAddress, tokenBAddress, swapAmount, quoterContract, config);

  return poolFee;
}

async function getTokenValueEnhanced(
  tokenSymbol: string,
  token: string,
  tokenBalance: BigNumber,
  decimals: number,
  usdcAddress: string,
  yearnBalance?: BigNumber,
  interestAccrued?: any,
  config?: any,
) {
  let effectiveBalance = tokenBalance;
  if (config?.YEARN_ENABLED && yearnBalance) {
    effectiveBalance = yearnBalance.add(interestAccrued).add(tokenBalance);
  }
  return tokenSymbol === "USDC.E" || tokenSymbol === "USDC"
    ? effectiveBalance.mul(1e12)
    : await getTokenValue(tokenSymbol, token, effectiveBalance, decimals, usdcAddress, config);
}

export async function rebalancePortfolio(
  dexWallet: DexWallet,
  desiredTokens: string[],
  desiredAllocations: { [token: string]: number },
  usdcAddress: string,
  customConfig: any,
) {
  pc.log("**************************************************************************");
  pc.log("⚖️  Rebalance Portfolio\n", "🔋 Check Gas and Recharge\n");

  type Tswap = {
    dexWallet: DexWallet;
    token0: string;
    token1: string;
    reverse: boolean;
    protocol: string;
    chainId: string;
    amount: number;
  };

  config = customConfig;

  const swaps: Tswap[] = [];

  // Recharge Fees
  await rechargeFees(dexWallet, config);

  const chainId = dexWallet.walletProvider.network.chainId;
  const _usdBalance = await getTokenBalance(dexWallet.walletProvider, dexWallet.walletAddress, usdcAddress);

  let usdBalance = _usdBalance.balance;
  //let totalPortfolioValue = BigNumber.from(usdBalance.mul(1e12).toString());
  let totalPortfolioValue = BigNumber.from(0);

  pc.log("🏦 Total Portfolio Value (in USDT) at Start: ", formatEther(totalPortfolioValue));

  let tokenValues: { [token: string]: BigNumber } = {};

  // First, calculate the current value of each token in the portfolio
  for (const token of desiredTokens) {
    let tokenValue;
    const tokenContract = new ethers.Contract(token, erc20Abi, dexWallet.wallet);
    const tokenMetadata = await getTokenMetadata(token, dexWallet.walletProvider);
    const _tokenbalance = await getTokenBalance(dexWallet.walletProvider, dexWallet.walletAddress, token);
    const tokenBalance = _tokenbalance.balance;
    const decimals = tokenMetadata.decimals;
    const tokenSymbol = await tokenContract?.symbol();
    const yearnVaultDetails = config?.YEARN_VAULTS[tokenSymbol];
    if (yearnVaultDetails !== undefined) {
      const yearnContract = new ethers.Contract(yearnVaultDetails, erc20Abi, dexWallet.wallet);
      const yearnBalance = await yearnContract?.balanceOf(dexWallet.walletAddress);
      const interestAccrued = await accuredYearnInterest(yearnVaultDetails, dexWallet);

      tokenValue = await getTokenValueEnhanced(
        tokenSymbol,
        token,
        tokenBalance,
        decimals,
        usdcAddress,
        yearnBalance,
        interestAccrued,
        config,
      );

      tokenValues[token] = tokenValue;
    } else {
      // Handle tokens without Yearn Vault
      tokenValue = await getTokenValue(tokenSymbol, token, tokenBalance, decimals, config?.USDC, config);
    }
    tokenValues[token] = tokenValue;
    totalPortfolioValue = totalPortfolioValue.add(tokenValue);
  }

  pc.log("🏦 Total Portfolio Value (in USDT): ", formatEther(totalPortfolioValue));
  // Calculate the current allocations
  let currentAllocations: { [token: string]: number } = {};

  Object.keys(tokenValues).forEach(token => {
    currentAllocations[token] = tokenValues[token].mul(10000).div(totalPortfolioValue).toNumber(); // Store as percentage
  });

  // Segregate tokens into sell and buy lists
  let tokensToSell = [];
  let tokensToBuy = [];

  // Find token to sell and buy
  for (const token of desiredTokens) {
    const currentAllocation = currentAllocations[token]; // current allocation as percentage
    const desiredAllocation = desiredAllocations[token];
    const difference = desiredAllocation - currentAllocation; // Calculate the difference for each token
    const tokenMetadata = await getTokenMetadata(token, dexWallet.walletProvider);
    const _tokenBalance = await getTokenBalance(dexWallet.walletProvider, dexWallet.walletAddress, token);
    const tokenSymbol: string = tokenMetadata.symbol as string;
    const yearnVaultDetails = config?.YEARN_VAULTS[tokenSymbol];

    let tokenBalance = _tokenBalance.balance;

    if (yearnVaultDetails) {
      const yearnContract = new ethers.Contract(yearnVaultDetails, erc20Abi, dexWallet.wallet);
      const yearnBalance = await yearnContract?.balanceOf(dexWallet.walletAddress);
      tokenBalance = _tokenBalance.balance.add(yearnBalance);
    }

    const valueToRebalance = totalPortfolioValue.mul(BigNumber.from(Math.abs(difference))).div(10000); // USDT value to rebalance

    pc.log(
      `🪙  Token: ${token}`,
      `📊 Current Allocation: ${currentAllocation}%`,
      `💰 Difference: ${difference}%`,
      `💲 Value (USD): ${formatEther(tokenValues[token])}`,
      `⚖️  Value to Rebalance (USD): ${formatEther(valueToRebalance)}`,
      `👛 Balance: ${formatEther(tokenBalance)} ${tokenSymbol}`,
    );

    if (difference < 0 && Math.abs(difference) > config?.LIMIT) {
      //const tokenPriceInUSDT = await quotePair(token, usdcAddress);
      const tokenMetadata = await getTokenMetadata(token, dexWallet?.walletProvider);
      const decimals = tokenMetadata.decimals;
      const _token = {
        address: token,
        decimals: decimals,
      };
      const tokenPriceInUSDT: any = await fetchPrices(_token, config); // Ensure this returns a value
      const pricePerToken = ethers.utils.parseUnits(tokenPriceInUSDT!.toString(), "ether");
      const tokenAmountToSell = valueToRebalance.mul(BigNumber.from(10).pow(decimals)).div(pricePerToken);

      if (token === usdcAddress) {
        pc.log("SKIP USDC SELL");
        break;
      }
      tokensToSell.push({ token, amount: tokenAmountToSell });
    } else if (difference > 0 && Math.abs(difference) > config?.LIMIT) {
      if (token === usdcAddress) {
        pc.log("SKIP USDC SELL");
        break;
      }
      tokensToBuy.push({ token, amount: valueToRebalance.div(1e12) });
    }
  }

  // Sell Tokens
  pc.log("🔄 Sell Tokens");
  for (let { token, amount: amountWei } of tokensToSell) {
    pc.info(`🔴 Selling ${formatEther(amountWei)} worth of ${token}`);
    const tokenContract = new Contract(token, erc20Abi, dexWallet.wallet);
    const tokenSymbol = await tokenContract.symbol();
    const yearnVaultDetails = config?.YEARN_VAULTS[tokenSymbol];
    const tokenDecimal = await tokenContract.decimals();

    let intAmount = Number(formatUnits(amountWei, tokenDecimal));

    const handleTokenRedemption = async (
      tokenBalance: { lt: (arg0: BigNumber) => any },
      yearnBalance: BigNumber,
      dexWallet: DexWallet,
      yearnContract: string,
    ) => {
      return intAmount;
    };

    if (yearnVaultDetails) {
      const balance = await getTokenBalance(dexWallet.walletProvider, dexWallet.walletAddress, token);
      const yearnContract = new ethers.Contract(yearnVaultDetails, erc20Abi, dexWallet.wallet);
      const yearnBalance = await yearnContract?.balanceOf(dexWallet.walletAddress);
      if (Number(amountWei) > Number(balance)) {
        await redeemFromYearn(yearnContract.address, yearnBalance, dexWallet, config);
      }
    }

    const [rsiResult, stochasticRSIResult] = await getRSI(tokenSymbol, config);

    if (
      stochasticRSIResult.stochRSI > config?.STOCKRSI_OVERBOUGHT &&
      rsiResult.rsiVal > config?.RSI_OVERBOUGHT &&
      config?.TECNICAL_ANALYSIS
    ) {
      //await swapCustom(dexWallet, [token, usdcAddress], false, amount); // true for reverse because we're selling
      const tokenSymbol = await tokenContract.symbol();

      const swap: Tswap = {
        dexWallet,
        token0: tokenSymbol,
        token1: "USDC.E",
        reverse: false,
        protocol: config?.SELECTED_PROTOCOL,
        chainId: config?.SELECTED_CHAINID,
        amount: intAmount,
      };

      swaps.push(swap);
    } else if (!config?.TECNICAL_ANALYSIS) {
      //await swapCustom(dexWallet, [token, usdcAddress], false, amount); // true for reverse because we're selling

      const swap: Tswap = {
        dexWallet: dexWallet,
        token0: tokenSymbol,
        token1: "USDC.E",
        reverse: false,
        protocol: config?.SELECTED_PROTOCOL,
        chainId: config?.SELECTED_CHAINID,
        amount: intAmount,
      };

      swaps.push(swap);
    } else {
      pc.warn("⚠️ Waiting for StochRSI overBought");
    }
  }

  pc.log("🔄 Buy Tokens");
  for (let { token, amount: amountWei } of tokensToBuy) {
    if (token === usdcAddress) {
      pc.log("SKIP USDC BUY");
      break;
    }

    pc.info(`🟩 Buying ${Number(amountWei) / 1e6} USDC worth of ${token}`);

    const tokenContract = new Contract(token, erc20Abi, dexWallet.wallet);
    const tokenSymbol = await tokenContract.symbol();

    const intAmount = Number(formatUnits(amountWei, 6));
    pc.log("Adjusted amount", intAmount);

    const [rsiResult, stochasticRSIResult] = await getRSI(tokenSymbol, config);

    // Call swapCustom or equivalent function to buy the token
    // Here we're assuming that swapCustom is flexible enough to handle both buying and selling

    const _usdBalance = await getTokenBalance(dexWallet.walletProvider, dexWallet.walletAddress, config?.USDC);
    usdBalance = _usdBalance.balance;

    const yearnVaultDetails = config?.YEARN_VAULTS.USDC;
    const yearnContract = new ethers.Contract(yearnVaultDetails, erc20Abi, dexWallet.wallet);
    const balanceYearnUSDC = await yearnContract?.balanceOf(dexWallet.walletAddress);

    const isTechnicalAnalysisConditionMet =
      stochasticRSIResult.stochRSI < config?.STOCKRSI_OVERSOLD && rsiResult.rsiVal < config?.RSI_OVERSOLD;

    if (usdBalance.lt(amountWei)) {
      await redeemFromYearn(yearnVaultDetails, balanceYearnUSDC, dexWallet, config);
    }

    // Check if either technical analysis condition is met or if technical analysis is disabled
    if (isTechnicalAnalysisConditionMet || !config?.TECNICAL_ANALYSIS) {
      if (usdBalance.gte(amountWei)) {
        //await swapCustom(dexWallet, [token, usdcAddress], true, amount);

        const tokenSymbol = await tokenContract.symbol();

        const swap: Tswap = {
          dexWallet: dexWallet,
          token0: tokenSymbol,
          token1: "USDC.E",
          reverse: true,
          protocol: config?.SELECTED_PROTOCOL,
          chainId: config?.SELECTED_CHAINID,
          amount: intAmount,
        };

        swaps.push(swap);
      } else if (usdBalance.lt(amountWei)) {
        pc.log("Use all USDT to buy");
        //await swapCustom(dexWallet, [token, usdcAddress], true, usdBalance);

        const tokenSymbol = await tokenContract.symbol();

        const swap: Tswap = {
          dexWallet: dexWallet,
          token0: tokenSymbol,
          token1: "USDC.E",
          reverse: true,
          protocol: config?.SELECTED_PROTOCOL,
          chainId: config?.SELECTED_CHAINID,
          amount: Number(formatUnits(usdBalance, 6)),
        };

        swaps.push(swap);
      } else {
        pc.error("✖️ Not enough USDT to buy, balance under 60% of required USD");
      }
    } else {
      pc.warn("Waiting for StochRSI OverSold");
    }
  }

  const tx = await batchSwap(swaps);

  let broadcasted = await waitForTx(dexWallet.wallet.provider, tx.hash as string);

  pc.log("📡 Transaction broadcasted:", broadcasted);
  pc.info("⚖️ Deposit to Yearn Vaults");

  for (const vault of Object.values(config?.YEARN_VAULTS)) {
    const vaultAsset = await getVaultAsset(String(vault), dexWallet);
    const assetContract = new ethers.Contract(vaultAsset, erc20Abi, dexWallet.wallet);
    const balance = await assetContract.balanceOf(dexWallet.walletAddress);
    if (balance.gt(0)) {
      if (tokensToBuy.length == 0 && tokensToSell.length == 0) {
        await depositToYearn(
          vaultAsset,
          String(vault), // Qui è stato corretto
          balance,
          dexWallet,
          config,
        );
      }
    }
  }

  pc.success("✔️ Rebalance completed.");
}

// async function executeSwap(
//   tokenA: string,
//   tokenB: string,
//   poolFee: Number,
//   swapAmount: BigNumber,
//   walletAddress: string,
//   swapRouterContract: Contract,
//   quoterContract: Contract,
//   gasPrice: BigNumber,
//   provider: ethers.providers.JsonRpcProvider,
// ) {
//   let swapDeadline = Math.floor(Date.now() / 1000 + 60 * 60); // 1 hour from now
//   let minimumAmountB = await getAmountOut(tokenA, tokenB, poolFee, swapAmount, quoterContract, config);
//   let swapTxInputs = [
//     tokenA,
//     tokenB,
//     BigNumber.from(3000),
//     walletAddress,
//     BigNumber.from(swapDeadline),
//     swapAmount,
//     minimumAmountB,
//     BigNumber.from(0),
//   ];

//   let swapTxResponse = await callContractMethod(
//     swapRouterContract,
//     "exactInputSingle",
//     [swapTxInputs],
//     provider,
//     gasPrice,
//     BigNumber.from(0),
//   );

//   return [swapTxResponse, minimumAmountB];
// }
