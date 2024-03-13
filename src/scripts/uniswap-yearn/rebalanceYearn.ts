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
import { depositToYearn, redeemFromYearn, accuredYearnInterest, previewWithdraw, getVaultAsset } from "baluni-api";
import { swap } from "../uniswap/swap";
import { waitForTx } from "../../utils/networkUtils";

import { INFRA } from "baluni-api";
import routerAbi from "baluni-api/dist/abis/infra/Router.json";

const pc = loadPrettyConsole();
let config: any;

type Tswap = {
  dexWallet: DexWallet;
  token0: string;
  token1: string;
  reverse: boolean;
  protocol: string;
  chainId: string;
  amount: string;
  slippage: number;
};

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

  const chainId = await dexWallet.wallet.getChainId();
  const routerAddress = INFRA[chainId].ROUTER;
  const router = new ethers.Contract(routerAddress, routerAbi, dexWallet.wallet);
  const gasLimit = 30000000;
  const gasPrice = await dexWallet.walletProvider?.getGasPrice();
  const gas = gasPrice.add(gasPrice.div(5));

  // Recharge Fees
  // -----------------------------------------------------------------------
  // -----------------------------------------------------------------------
  await rechargeFees(dexWallet, config);
  let totalPortfolioValue = BigNumber.from(0);
  let tokenValues: { [token: string]: BigNumber } = {};
  pc.log("🏦 Total Portfolio Value (in USDT) at Start: ", formatEther(totalPortfolioValue));

  // Calculate the total value of the portfolio
  // -----------------------------------------------------------------------
  // -----------------------------------------------------------------------
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
      const interestAccrued = await accuredYearnInterest(
        yearnVaultDetails,
        dexWallet.walletAddress,
        config?.SELECTED_CHAINID,
      );

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
      tokenValue = await getTokenValue(tokenSymbol, token, tokenBalance, decimals, config?.USDC, config);
    }
    tokenValues[token] = tokenValue;
    totalPortfolioValue = totalPortfolioValue.add(tokenValue);
  }

  pc.log("🏦 Total Portfolio Value (in USDT): ", formatEther(totalPortfolioValue));
  let currentAllocations: { [token: string]: number } = {};
  let tokensToSell = [];
  let tokensToBuy = [];

  let _swap: Tswap = {
    dexWallet: dexWallet,
    token0: "",
    token1: "",
    reverse: false,
    protocol: "",
    chainId: "",
    amount: "",
    slippage: 0,
  };

  Object.keys(tokenValues).forEach(token => {
    currentAllocations[token] = tokenValues[token].mul(10000).div(totalPortfolioValue).toNumber(); // Store as percentage
  });

  // Calculate the difference for each token
  // -----------------------------------------------------------------------
  // -----------------------------------------------------------------------
  for (const token of desiredTokens) {
    const currentAllocation = currentAllocations[token]; // current allocation as percentage
    const desiredAllocation = desiredAllocations[token];
    const difference = desiredAllocation - currentAllocation; // Calculate the difference for each token
    const tokenMetadata = await getTokenMetadata(token, dexWallet.walletProvider);
    const _tokenBalance = await getTokenBalance(dexWallet.walletProvider, dexWallet.walletAddress, token);
    let tokenBalance = _tokenBalance.balance;
    const tokenSymbol: string = tokenMetadata.symbol as string;
    const yearnVaultDetails = config?.YEARN_VAULTS[tokenSymbol];
    if (yearnVaultDetails) {
      const yearnContract = new ethers.Contract(yearnVaultDetails, erc20Abi, dexWallet.wallet);
      const yearnBalance = await yearnContract?.balanceOf(dexWallet.walletAddress);
      tokenBalance = _tokenBalance.balance.add(yearnBalance);
    }

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
  // -----------------------------------------------------------------------
  // -----------------------------------------------------------------------

  for (let { token, amount } of tokensToSell) {
    const tokenContract = new Contract(token, erc20Abi, dexWallet.wallet);
    const tokenDecimals = await tokenContract.decimals();
    const tokenSymbol = await tokenContract.symbol();
    pc.info(`🔴 Selling ${formatUnits(amount, tokenDecimals)} worth of ${token}`);
    const adjustedAmount = formatUnits(amount, tokenDecimals);
    const handleTokenRedemption = async (
      tokenBalance: { lt: (arg0: BigNumber) => any },
      yearnBalance: BigNumber,
      dexWallet: DexWallet,
      yearnContract: string,
    ) => {
      if (tokenBalance.lt(amount)) {
        const data = await redeemFromYearn(
          dexWallet.wallet,
          yearnContract,
          yearnBalance,
          dexWallet.walletAddress,
          config?.SELECTED_CHAINID,
        );

        if (data?.Approvals) {
          const approvals = data.Approvals;
          for (const approval of approvals) {
            const approvalTx = await dexWallet.wallet.sendTransaction(approval);
            const broadcaster = await waitForTx(dexWallet.walletProvider, approvalTx?.hash, dexWallet.walletAddress);
            pc.log("📡 Approval broadcasted:", broadcaster);
          }
        }

        const simulate = await router.callStatic.execute(data?.Calldatas, data?.TokensReturn, {
          // // gasLimit: gasLimit,
          // gasPrice: gas,
        });

        pc.log("📡 Simulation successful:", await simulate);

        if (simulate) {
          const tx = await router.execute(data?.Calldatas, data?.TokensReturn, {
            // // gasLimit: gasLimit,
            // gasPrice: gas,
          });
          const broadcaster = await waitForTx(dexWallet.walletProvider, tx?.hash, dexWallet.walletAddress);
          pc.log("📡 Tx broadcasted:", broadcaster);
        }
      }
      return amount;
    };

    const yearnVaultDetails = config?.YEARN_VAULTS[tokenSymbol];

    if (yearnVaultDetails) {
      const balance = await getTokenBalance(dexWallet.walletProvider, dexWallet.walletAddress, token);
      const yearnContract = new ethers.Contract(yearnVaultDetails, erc20Abi, dexWallet.wallet);
      const yearnBalance = await yearnContract?.balanceOf(dexWallet.walletAddress);
      amount = await handleTokenRedemption(balance.balance, yearnBalance, dexWallet, yearnVaultDetails);
    }

    const [rsiResult, stochasticRSIResult] = await getRSI(tokenSymbol, config);

    if (
      stochasticRSIResult.stochRSI > config?.STOCKRSI_OVERBOUGHT &&
      rsiResult.rsiVal > config?.RSI_OVERBOUGHT &&
      config?.TECNICAL_ANALYSIS
    ) {
      const tokenSymbol = await tokenContract.symbol();
      _swap = {
        dexWallet: dexWallet,
        token0: tokenSymbol,
        token1: "USDC.E",
        reverse: false,
        protocol: config?.SELECTED_PROTOCOL,
        chainId: config?.SELECTED_CHAINID,
        amount: adjustedAmount,
        slippage: Number(config?.SLIPPAGE),
      };
    } else if (!config?.TECNICAL_ANALYSIS) {
      const tokenDecimals = await tokenContract.decimals();
      const adjustedAmount = formatUnits(amount, tokenDecimals);
      const tokenSymbol = await tokenContract.symbol();
      _swap = {
        dexWallet: dexWallet,
        token0: tokenSymbol,
        token1: "USDC.E",
        reverse: false,
        protocol: config?.SELECTED_PROTOCOL,
        chainId: config?.SELECTED_CHAINID,
        amount: adjustedAmount,
        slippage: Number(config?.SLIPPAGE),
      };
    } else {
      pc.warn("⚠️ Waiting for StochRSI overBought");
    }
  }

  // Execute sell
  // -----------------------------------------------------------------------
  // -----------------------------------------------------------------------

  if (tokensToSell.length > 0) {
    await swap(
      _swap.dexWallet,
      _swap.token0,
      _swap.token1,
      _swap.reverse,
      _swap.protocol,
      _swap.chainId,
      _swap.amount,
      _swap.slippage,
    );
  }

  // Buy Tokens
  // -----------------------------------------------------------------------
  // -----------------------------------------------------------------------
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
    const yearnVaultDetails = config?.YEARN_VAULTS.USDC;
    const yearnContract = new ethers.Contract(yearnVaultDetails, erc20Abi, dexWallet.wallet);
    const balanceYearnUSDC = await yearnContract?.balanceOf(dexWallet.walletAddress);
    const isTechnicalAnalysisConditionMet =
      stochasticRSIResult.stochRSI < config?.STOCKRSI_OVERSOLD && rsiResult.rsiVal < config?.RSI_OVERSOLD;

    if (usdBalance.lt(amount)) {
      await redeemFromYearn(
        dexWallet.wallet,
        yearnVaultDetails,
        balanceYearnUSDC,
        dexWallet.walletAddress,
        config?.SELECTED_CHAINID,
      );
    }

    // Check if either technical analysis condition is met or if technical analysis is disabled
    if (isTechnicalAnalysisConditionMet || !config?.TECNICAL_ANALYSIS) {
      if (usdBalance.gte(amount)) {
        const adjustedAmount = formatUnits(amount, 6);
        const tokenSymbol = await tokenContract.symbol();

        _swap = {
          dexWallet: dexWallet,
          token0: tokenSymbol,
          token1: "USDC.E",
          reverse: true,
          protocol: config?.SELECTED_PROTOCOL,
          chainId: config?.SELECTED_CHAINID,
          amount: adjustedAmount,
          slippage: Number(config?.SLIPPAGE),
        };
      } else if (usdBalance.lt(amount)) {
        pc.log("Use all USDT to buy");
        const tokenDecimals = await tokenContract.decimals();
        const adjustedAmount = usdBalance.balance;
        const tokenSymbol = await tokenContract.symbol();

        _swap = {
          dexWallet: dexWallet,
          token0: tokenSymbol,
          token1: "USDC.E",
          reverse: true,
          protocol: config?.SELECTED_PROTOCOL,
          chainId: config?.SELECTED_CHAINID,
          amount: adjustedAmount,
          slippage: Number(config?.SLIPPAGE),
        };
      } else {
        pc.error("✖️ Not enough USDT to buy, balance under 60% of required USD");
      }
    } else {
      pc.warn("Waiting for StochRSI OverSold");
    }
  }

  // Execute buy
  // -----------------------------------------------------------------------
  // -----------------------------------------------------------------------
  if (tokensToBuy.length > 0) {
    await swap(
      _swap.dexWallet,
      _swap.token0,
      _swap.token1,
      _swap.reverse,
      _swap.protocol,
      _swap.chainId,
      _swap.amount,
      _swap.slippage,
    );
  }

  // Deposit to Yearn
  // -----------------------------------------------------------------------
  // -----------------------------------------------------------------------
  for (const vault of Object.values(config?.YEARN_VAULTS)) {
    const vaultAsset = await getVaultAsset(String(vault), config?.SELECTED_CHAINID);
    const assetContract = new ethers.Contract(vaultAsset, erc20Abi, dexWallet.wallet);
    const balance = await assetContract.balanceOf(dexWallet.walletAddress);
    if (balance.gt(0)) {
      if (tokensToBuy.length == 0 && tokensToSell.length == 0) {
        const data = await depositToYearn(
          dexWallet.wallet,
          vaultAsset,
          String(vault), // Qui è stato corretto
          balance,
          dexWallet.walletAddress,
          config?.SELECTED_CHAINID,
        );

        if (data?.Approvals) {
          const approvals = data.Approvals;
          for (const approval of approvals) {
            const approvalTx = await dexWallet.wallet.sendTransaction(approval);
            const broadcaster = await waitForTx(dexWallet.walletProvider, approvalTx?.hash, dexWallet.walletAddress);
            pc.log("📡 Approval broadcasted:", broadcaster);
          }
        }

        const simulate = await router.callStatic.execute(data?.Calldatas, data?.TokensReturn, {
          gasLimit: gasLimit,
        });

        if (!simulate) return console.log("Simulation Failed");

        pc.log("📡 Simulation successful:", await simulate);

        pc.assert("Send tx");
        const tx = await router.execute(data.Calldatas, data.TokensReturn);
        const broadcaster = await waitForTx(dexWallet.walletProvider, tx?.hash, dexWallet.walletAddress);
        pc.log("📡 Tx broadcasted:", broadcaster);
      }
    }
  }

  pc.success("✔️ Rebalance completed.");
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
