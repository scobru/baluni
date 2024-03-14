import { BigNumber, Contract, ethers } from "ethers";
import { DexWallet } from "../../utils/dexWallet";
import erc20Abi from "../../abis/common/ERC20.json";
import { formatEther, formatUnits } from "ethers/lib/utils";
import { fetchPrices } from "../../utils/quote1Inch";
import { rechargeFees } from "../../utils/rechargeFees";
import { getTokenMetadata } from "../../utils/getTokenMetadata";
import { getTokenBalance } from "../../utils/getTokenBalance";
import { getTokenValue } from "../../utils/getTokenValue";
import { getRSI } from "../../utils/getRSI";
import { loadPrettyConsole } from "../../utils/prettyConsole";
import { swap } from "./actions/swap";

const pc = loadPrettyConsole();

let config: any;

export async function rebalancePortfolio(
  dexWallet: DexWallet,
  desiredTokens: string[],
  desiredAllocations: { [token: string]: number },
  usdcAddress: string,
  customConfig: any,
) {
  pc.log("**************************************************************************");
  pc.log("⚖️  Rebalance Portfolio\n", "🔋 Check Gas and Recharge\n");

  config = customConfig;

  await rechargeFees(dexWallet, config);
  // const chainId = dexWallet.walletProvider.network.chainId;

  const _usdBalance = await getTokenBalance(dexWallet.walletProvider, dexWallet.walletAddress, usdcAddress);
  let usdBalance = _usdBalance.balance;

  // let totalPortfolioValue = BigNumber.from(usdBalance.mul(1e12).toString());
  let totalPortfolioValue = BigNumber.from(0);

  pc.log("🏦 Total Portfolio Value (in USDT) at Start: ", formatEther(totalPortfolioValue));

  let tokenValues: { [token: string]: BigNumber } = {};

  for (const token of desiredTokens) {
    let tokenValue;
    const tokenContract = new ethers.Contract(token, erc20Abi, dexWallet.wallet);
    const tokenMetadata = await getTokenMetadata(token, dexWallet.walletProvider);
    const _tokenbalance = await getTokenBalance(dexWallet.walletProvider, dexWallet.walletAddress, token);
    const tokenBalance = _tokenbalance.balance;
    const decimals = tokenMetadata.decimals;
    const tokenSymbol = await tokenContract?.symbol();
    tokenValue = await getTokenValue(tokenSymbol, token, tokenBalance, decimals, usdcAddress, config);
    tokenValues[token] = tokenValue;
    totalPortfolioValue = totalPortfolioValue.add(tokenValue);
  }

  pc.log("🏦 Total Portfolio Value (in USDT): ", formatEther(totalPortfolioValue));

  let currentAllocations: { [token: string]: number } = {};

  Object.keys(tokenValues).forEach(token => {
    currentAllocations[token] = tokenValues[token].mul(10000).div(totalPortfolioValue).toNumber(); // Store as percentage
  });

  let tokensToSell = [];
  let tokensToBuy = [];

  for (const token of desiredTokens) {
    const currentAllocation = currentAllocations[token]; // current allocation as percentage
    const desiredAllocation = desiredAllocations[token];
    const difference = desiredAllocation - currentAllocation; // Calculate the difference for each token
    const tokenMetadata = await getTokenMetadata(token, dexWallet.walletProvider);
    const _tokenBalance = await getTokenBalance(dexWallet.walletProvider, dexWallet.walletAddress, token);
    let tokenBalance = _tokenBalance.balance;
    const tokenSymbol: string = tokenMetadata.symbol as string;

    const valueToRebalance = totalPortfolioValue.mul(BigNumber.from(Math.abs(difference))).div(10000);

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
      const tokenMetadata = await getTokenMetadata(token, dexWallet.walletProvider);
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
  for (let { token, amount } of tokensToSell) {
    const tokenContract = new Contract(token, erc20Abi, dexWallet.wallet);
    const tokenDecimals = await tokenContract.decimals();
    const tokenSymbol = await tokenContract.symbol();
    pc.info(`🔴 Selling ${formatUnits(amount, tokenDecimals)} worth of ${token}`);
    const adjustedAmount = formatUnits(amount, tokenDecimals);
    const [rsiResult, stochasticRSIResult] = await getRSI(tokenSymbol, config);

    if (
      stochasticRSIResult.stochRSI > config?.STOCKRSI_OVERBOUGHT &&
      rsiResult.rsiVal > config?.RSI_OVERBOUGHT &&
      config?.TECNICAL_ANALYSIS
    ) {
      const tokenSymbol = await tokenContract.symbol();
      await swap(
        dexWallet,
        tokenSymbol,
        "USDC.E",
        false,
        config?.SELECTED_PROTOCOL,
        config?.SELECTED_CHAINID,
        adjustedAmount,
        Number(config?.SLIPPAGE),
      );

      await new Promise(resolve => setTimeout(resolve, 10000));
    } else if (!config?.TECNICAL_ANALYSIS) {
      const tokenDecimals = await tokenContract.decimals();
      const adjustedAmount = formatUnits(amount, tokenDecimals);
      const tokenSymbol = await tokenContract.symbol();

      await swap(
        dexWallet,
        tokenSymbol,
        "USDC.E",
        false,
        config?.SELECTED_PROTOCOL,
        config?.SELECTED_CHAINID,
        adjustedAmount,
        Number(config?.SLIPPAGE),
      );

      await new Promise(resolve => setTimeout(resolve, 10000));
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

    pc.info(`🟩 Buying ${formatUnits(amount, 6)} USDC worth of ${token}`);

    const tokenContract = new Contract(token, erc20Abi, dexWallet.wallet);
    const tokenSymbol = await tokenContract.symbol();
    const [rsiResult, stochasticRSIResult] = await getRSI(tokenSymbol, config);
    const usdBalance = (await getTokenBalance(dexWallet.walletProvider, dexWallet.walletAddress, config?.USDC)).balance;
    const isTechnicalAnalysisConditionMet =
      stochasticRSIResult.stochRSI < config?.STOCKRSI_OVERSOLD && rsiResult.rsiVal < config?.RSI_OVERSOLD;

    // Check if either technical analysis condition is met or if technical analysis is disabled
    if (isTechnicalAnalysisConditionMet || !config?.TECNICAL_ANALYSIS) {
      if (usdBalance.gte(amount)) {
        const adjustedAmount = formatUnits(amount, 6);
        const tokenSymbol = await tokenContract.symbol();

        await swap(
          dexWallet,
          tokenSymbol,
          "USDC.E",
          true,
          config?.SELECTED_PROTOCOL,
          config?.SELECTED_CHAINID,
          adjustedAmount,
          Number(config?.SLIPPAGE),
        );

        await new Promise(resolve => setTimeout(resolve, 5000));
      } else if (usdBalance.lt(amount)) {
        pc.log("Use all USDT to buy");
        //await swapCustom(dexWallet, [token, usdcAddress], true, usdBalance);
        const tokenDecimals = await tokenContract.decimals();
        const adjustedAmount = formatUnits(usdBalance, 6);
        const tokenSymbol = await tokenContract.symbol();

        await swap(
          dexWallet,
          tokenSymbol,
          "USDC.E",
          true,
          config?.SELECTED_PROTOCOL,
          config?.SELECTED_CHAINID,
          adjustedAmount,
          config?.SLIPPAGE,
        );
      } else {
        pc.error("✖️ Not enough USDT to buy, balance under 60% of required USD");
      }
    } else {
      pc.warn("Waiting for StochRSI OverSold");
    }
  }

  pc.success("✔️ Rebalance completed.");
}
