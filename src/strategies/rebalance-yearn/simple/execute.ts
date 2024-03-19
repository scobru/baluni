import { BigNumber, Contract, ethers } from "ethers";
import { DexWallet } from "../../../utils/web3/dexWallet";
import { formatEther, formatUnits, parseUnits } from "ethers/lib/utils";
import { fetchPrices } from "../../../utils/quote1Inch";
import { getTokenMetadata } from "../../../utils/getTokenMetadata";
import { getTokenBalance } from "../../../utils/getTokenBalance";
import { getTokenValue } from "../../../utils/getTokenValue";
import { getRSI } from "../../../features/ta/getRSI";
import { loadPrettyConsole } from "../../../utils/prettyConsole";
import { swap } from "../../../common/uniswap/swap";
import { waitForTx } from "../../../utils/web3/networkUtils";
import { INFRA } from "baluni-api";
import { depositToYearn, redeemFromYearn, accuredYearnInterest, getVaultAsset } from "baluni-api";
import routerAbi from "baluni-api/dist/abis/infra/Router.json";
import erc20Abi from "baluni-api/dist/abis/common/ERC20.json";

// DEV ONLY

/* import { INFRA } from "../../../../baluni-api/dist";
import {
  depositToYearn,
  redeemFromYearn,
  accuredYearnInterest,
  previewWithdraw,
  getVaultAsset,
} from "../../../../baluni-api/dist"; */

const pc = loadPrettyConsole();
let config: any;

type Tswap = {
  dexWallet: DexWallet;
  token0: string;
  token1: string;
  reverse: boolean;
  protocol: string;
  chainId: number;
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

  const gasLimit = 8000000;
  const gas = await dexWallet.walletProvider.getGasPrice();

  const chainId = await dexWallet.wallet.getChainId();
  const routerAddress = INFRA[chainId].ROUTER;
  const router = new ethers.Contract(routerAddress, routerAbi, dexWallet.wallet);

  let totalPortfolioValue = BigNumber.from(0);
  let tokenValues: { [token: string]: BigNumber } = {};

  pc.log("🏦 Total Portfolio Value (in USDT) at Start: ", formatEther(totalPortfolioValue));

  // Calculate the total value of the portfolio
  // -----------------------------------------------------------------------
  // -----------------------------------------------------------------------
  pc.success("📊 Calculating Portfolio Value");

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
        chainId,
      );

      tokenValues[token] = tokenValue;
    } else {
      tokenValue = await getTokenValue(tokenSymbol, token, tokenBalance, decimals, config?.USDC, String(chainId));
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
    chainId: 0,
    amount: "",
    slippage: 0,
  };

  Object.keys(tokenValues).forEach(token => {
    currentAllocations[token] = tokenValues[token].mul(10000).div(totalPortfolioValue).toNumber(); // Store as percentage
  });

  // Calculate the difference for each token
  // -----------------------------------------------------------------------
  // -----------------------------------------------------------------------
  pc.success("📊 Calculating Rebalance");
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
      const tokenMetadata = await getTokenMetadata(token, dexWallet.walletProvider);
      const decimals = tokenMetadata.decimals;
      const _token = {
        address: token,
        decimals: decimals,
      };

      const tokenPriceInUSDT: any = await fetchPrices(_token, String(chainId)); // Ensure this returns a value
      const pricePerToken = ethers.utils.parseUnits(tokenPriceInUSDT!.toString(), "ether");
      const tokenAmountToSell = valueToRebalance.mul(BigNumber.from(10).pow(decimals)).div(pricePerToken);
      if (token === usdcAddress) {
        pc.log("-- SKIP USDC SELL --");
        break;
      }

      tokensToSell.push({ token, amount: tokenAmountToSell });
    } else if (difference > 0 && Math.abs(difference) > config?.LIMIT) {
      if (token === usdcAddress) {
        pc.log("-- SKIP USDC SELL --");
        break;
      }
      tokensToBuy.push({ token, amount: valueToRebalance.div(1e12) });
    }
  }

  // Sell Tokens
  // -----------------------------------------------------------------------
  // -----------------------------------------------------------------------
  pc.success("📊 Selling Tokens");
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
          gasLimit: gasLimit,
          gasPrice: gas,
        });
        pc.log("📡 Simulation successful:", await simulate);

        if (simulate) {
          const tx = await router.execute(data?.Calldatas, data?.TokensReturn, {
            gasLimit: gasLimit,
            gasPrice: gas,
          });
          const broadcaster = await waitForTx(dexWallet.walletProvider, tx?.hash, dexWallet.walletAddress);
          pc.log("📡 Tx broadcasted:", broadcaster);
        }
      }
      return amount;
    };

    const vaultAddress = config?.YEARN_VAULTS[tokenSymbol];

    if (vaultAddress) {
      const balance = await getTokenBalance(dexWallet.walletProvider, dexWallet.walletAddress, token);
      const yearnContract = new ethers.Contract(vaultAddress, erc20Abi, dexWallet.wallet);
      const yearnBalance = await yearnContract?.balanceOf(dexWallet.walletAddress);
      amount = await handleTokenRedemption(balance.balance, yearnBalance, dexWallet, vaultAddress);
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
  pc.success("🟩 Execute Selling Tokens");
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
  pc.success("📊 Buying Tokens");
  for (let { token, amount } of tokensToBuy) {
    if (token === usdcAddress) {
      pc.log("-- SKIP USDC BUY --");
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

    if ((usdBalance.lt(amount) && balanceYearnUSDC.gt(amount)) || balanceYearnUSDC.eq(amount)) {
      pc.log("Redeeming from Yearn");

      const data = await redeemFromYearn(
        dexWallet.wallet,
        yearnVaultDetails,
        balanceYearnUSDC,
        dexWallet.walletAddress,
        config?.SELECTED_CHAINID,
      );

      try {
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
          gasPrice: gas,
        });

        if (simulate === false) return console.log("Simulation Failed");

        pc.log("📡 Simulation successful:", await simulate);

        const tx = await router.execute(data.Calldatas, data.TokensReturn, {
          gasLimit: gasLimit,
          gasPrice: gas,
        });
        const broadcaster = await waitForTx(dexWallet.walletProvider, tx?.hash, dexWallet.walletAddress);
        pc.log("📡 Tx broadcasted:", broadcaster);
      } catch (error) {
        console.error("Redeem Failed:", error);
        return;
      }
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
        pc.log("✖️ Insufficient USDC balance. Skipping buy.");
        const adjustedAmount = formatUnits(usdBalance, 6);
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
      }
    } else {
      pc.warn("Waiting for StochRSI OverSold");
    }
  }

  const usdBalance = (await getTokenBalance(dexWallet.walletProvider, dexWallet.walletAddress, config?.USDC)).balance;

  // Execute buy
  // -----------------------------------------------------------------------
  // -----------------------------------------------------------------------
  pc.success("🟩 Execute Buying Tokens");
  if (_swap.amount && usdBalance.gte(parseUnits(_swap.amount, 6))) {
    pc.log("🟩 Buying Tokens");
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
  pc.success("🟩 Deposit to Yearn");
  for (const vault of Object.values(config?.YEARN_VAULTS)) {
    const vaultAsset = await getVaultAsset(String(vault), config?.SELECTED_CHAINID);
    const assetContract = new ethers.Contract(vaultAsset, erc20Abi, dexWallet.wallet);
    const balance = await assetContract.balanceOf(dexWallet.walletAddress);
    if (balance.gt(0)) {
      if (tokensToBuy.length == 0 && tokensToSell.length == 0) {
        pc.log("🔵 Deposit to Yearn");
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
          gasPrice: gas,
        });

        if (simulate === false) return console.log("Simulation Failed");

        pc.log("📡 Simulation successful:", await simulate);
        pc.assert("Execute tx");
        const tx = await router.execute(data.Calldatas, data.TokensReturn, {
          gasPrice: await dexWallet.walletProvider.getGasPrice(),
        });
        const broadcaster = await waitForTx(dexWallet.walletProvider, tx?.hash, dexWallet.walletAddress);
        pc.log("📡 Tx broadcasted:", broadcaster);
      }
    }
  }

  pc.success("✔️ Rebalance completed.");
}

export async function getTokenValueEnhanced(
  tokenSymbol: string,
  token: string,
  tokenBalance: BigNumber,
  decimals: number,
  usdcAddress: string,
  yearnBalance?: BigNumber,
  interestAccrued?: any,
  chainId?: any,
) {
  let effectiveBalance = tokenBalance;

  if (config?.YEARN_ENABLED && yearnBalance) {
    effectiveBalance = yearnBalance.add(interestAccrued).add(tokenBalance);
  }

  return tokenSymbol === "USDC.E" || tokenSymbol === "USDC"
    ? effectiveBalance.mul(1e12)
    : await getTokenValue(tokenSymbol, token, effectiveBalance, decimals, usdcAddress, chainId);
}
