import { BigNumber, Contract, ethers } from "ethers";
import { DexWallet } from "../../../utils/web3/dexWallet";
import { formatEther, formatUnits, parseUnits } from "ethers/lib/utils";
import { fetchPrices } from "../../../utils/quote1Inch";
import { getTokenMetadata } from "../../../utils/getTokenMetadata";
import { getTokenBalance } from "../../../utils/getTokenBalance";
import { getTokenValue } from "../../../utils/getTokenValue";
import { getRSI } from "../../../utils/ta/getRSI";
import { loadPrettyConsole } from "../../../utils/prettyConsole";
import { batchSwap } from "../actions/batchSwap";
import { waitForTx } from "../../../utils/web3/networkUtils";
import { INFRA } from "baluni-api";
import { depositToYearnBatched, redeemFromYearnBatched, accuredYearnInterest, getVaultAsset } from "baluni-api";
import routerAbi from "baluni-api/dist/abis/infra/Router.json";
import erc20Abi from "baluni-api/dist/abis/common/ERC20.json";

// TEST ONLY

/* import {
  depositToYearn,
  redeemFromYearn,
  accuredYearnInterest,
  redeemFromYearnBatched,
  depositToYearnBatched,
  previewWithdraw,
  getVaultAsset,
} from "../../../../../baluni-api/dist"; */
// import { INFRA } from "../../../../baluni-api/dist";
// import routerAbi from "../../../../baluni-api/dist/abis/infra/Router.json";

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

type TDeposit = {
  wallet: ethers.Wallet;
  tokenAddr: string;
  pool: string;
  amount: BigNumber;
  receiver: string;
  chainId: string;
};

type TRedeem = {
  wallet: ethers.Wallet;
  pool: string;
  amount: BigNumber;
  receiver: string;
  chainId: string;
};

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
  config = customConfig;
  const gasLimit = 8000000;
  const gas = await dexWallet.walletProvider.getGasPrice();

  const swaps: Tswap[] = [];
  const chainId = dexWallet.walletProvider.network.chainId;

  const infraRouter = INFRA[chainId].ROUTER;
  const router = new ethers.Contract(infraRouter, routerAbi, dexWallet.wallet);

  let totalPortfolioValue = BigNumber.from(0);
  let tokenValues: { [token: string]: BigNumber } = {};

  pc.log("🏦 Total Portfolio Value (in USDT) at Start: ", formatEther(totalPortfolioValue));

  // Calculate Total Portfolio Value
  // --------------------------------------------------------------------------------
  // --------------------------------------------------------------------------------
  pc.success("📊 Calculate Total Portfolio Value");
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

      const interestAccrued = await accuredYearnInterest(yearnVaultDetails, dexWallet.walletAddress, chainId);
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

  Object.keys(tokenValues).forEach(token => {
    currentAllocations[token] = tokenValues[token].mul(10000).div(totalPortfolioValue).toNumber(); // Store as percentage
  });

  // Rebalance
  // --------------------------------------------------------------------------------
  // --------------------------------------------------------------------------------
  pc.success("📊 Rebalance Portfolio");
  for (const token of desiredTokens) {
    const currentAllocation = currentAllocations[token];
    const desiredAllocation = desiredAllocations[token];

    const difference = desiredAllocation - currentAllocation;
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
      // const tokenPriceInUSDT = await quotePair(token, usdcAddress);
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
  // --------------------------------------------------------------------------------
  // --------------------------------------------------------------------------------
  pc.success("🔄 Sell Tokens");
  const yearnRedeems = [];
  for (let { token, amount: amountWei } of tokensToSell) {
    const tokenContract = new Contract(token, erc20Abi, dexWallet.wallet);
    const tokenSymbol = await tokenContract.symbol();

    const tokenDecimal = await tokenContract.decimals();
    const pool = config?.YEARN_VAULTS[tokenSymbol];

    let intAmount = Number(formatUnits(amountWei, tokenDecimal));

    pc.info(`🔴 Selling ${formatUnits(amountWei, tokenDecimal)} worth of ${tokenSymbol}`);

    if (pool) {
      const balance = await getTokenBalance(dexWallet.walletProvider, dexWallet.walletAddress, token);
      const yearnCtx = new ethers.Contract(pool, erc20Abi, dexWallet.wallet);

      const yearnCtxBal = await yearnCtx?.balanceOf(dexWallet.walletAddress);

      if (Number(amountWei) > Number(await balance.balance) && Number(yearnCtxBal) >= Number(amountWei)) {
        pc.log("Redeem from Yearn");

        const data: TRedeem = {
          wallet: dexWallet.wallet,
          pool: pool,
          amount: yearnCtxBal,
          receiver: dexWallet.walletAddress,
          chainId: String(chainId),
        };

        yearnRedeems.push(data);
      }
    }
    const [rsiResult, stochasticRSIResult] = await getRSI(tokenSymbol, config);
    const balance = (await getTokenBalance(dexWallet.walletProvider, dexWallet.walletAddress, token)).balance;

    if (Number(amountWei) < balance) {
      if (
        stochasticRSIResult.stochRSI > config?.STOCKRSI_OVERBOUGHT &&
        rsiResult.rsiVal > config?.RSI_OVERBOUGHT &&
        config?.TECNICAL_ANALYSIS
      ) {
        const tokenSymbol = await tokenContract.symbol();
        const swap: Tswap = {
          dexWallet,
          token0: tokenSymbol,
          token1: "USDC.E",
          reverse: false,
          protocol: config?.SELECTED_PROTOCOL,
          chainId: config?.SELECTED_CHAINID,
          amount: String(intAmount),
          slippage: Number(config?.SLIPPAGE),
        };
        swaps.push(swap);
      } else if (!config?.TECNICAL_ANALYSIS) {
        const swap: Tswap = {
          dexWallet: dexWallet,
          token0: tokenSymbol,
          token1: "USDC.E",
          reverse: false,
          protocol: config?.SELECTED_PROTOCOL,
          chainId: config?.SELECTED_CHAINID,
          amount: String(intAmount),
          slippage: Number(config?.SLIPPAGE),
        };
        swaps.push(swap);
      } else {
        pc.warn("⚠️ Waiting for StochRSI overBought");
      }
    }
  }

  // Buy Tokens
  // --------------------------------------------------------------------------------
  // --------------------------------------------------------------------------------
  pc.success("🔄 Buy Tokens");
  const poolAddress = config?.YEARN_VAULTS.USDC;
  const poolCtx = new ethers.Contract(poolAddress, erc20Abi, dexWallet.wallet);
  const yBalUSDC = await poolCtx?.balanceOf(dexWallet.walletAddress);

  for (let { token, amount: amountWei } of tokensToBuy) {
    if (token === usdcAddress) {
      pc.log("SKIP USDC BUY");
      break;
    }

    pc.info(`🟩 Buying ${Number(amountWei) / 1e6} USDC worth of ${token}`);

    const tokenCtx = new Contract(token, erc20Abi, dexWallet.wallet);
    const tokenSym = await tokenCtx.symbol();

    const intAmount = Number(formatUnits(amountWei, 6));
    const [rsiResult, stochasticRSIResult] = await getRSI(tokenSym, config);

    const balUSD: BigNumber = await (
      await getTokenBalance(dexWallet.walletProvider, dexWallet.walletAddress, config?.USDC)
    )?.balance;

    const isTechnicalAnalysisConditionMet =
      stochasticRSIResult.stochRSI < config?.STOCKRSI_OVERSOLD && rsiResult.rsiVal < config?.RSI_OVERSOLD;

    if (balUSD.lt(amountWei) && yBalUSDC.gt(amountWei)) {
      const data: TRedeem = {
        wallet: dexWallet.wallet,
        pool: poolAddress,
        amount: yBalUSDC,
        receiver: dexWallet.walletAddress,
        chainId: String(chainId),
      };
      yearnRedeems.push(data);
    }

    if (balUSD.gt(amountWei)) {
      if (isTechnicalAnalysisConditionMet || !config?.TECNICAL_ANALYSIS) {
        const tokenSym = await tokenCtx.symbol();
        const swap: Tswap = {
          dexWallet: dexWallet,
          token0: tokenSym,
          token1: "USDC.E",
          reverse: true,
          protocol: config?.SELECTED_PROTOCOL,
          chainId: config?.SELECTED_CHAINID,
          amount: String(intAmount),
          slippage: Number(config?.SLIPPAGE),
        };
        swaps.push(swap);
      } else {
        pc.warn("⚠️ Waiting for StochRSI overSold");
      }
    } else if (balUSD.gte(0)) {
      pc.warn("⚠️ Not enough USDC to buy", token);
      const adjustedAmount = parseUnits(String(balUSD), 6);
      const tokenSym = await tokenCtx.symbol();
      const swap: Tswap = {
        dexWallet: dexWallet,
        token0: tokenSym,
        token1: "USDC.E",
        reverse: true,
        protocol: config?.SELECTED_PROTOCOL,
        chainId: config?.SELECTED_CHAINID,
        amount: String(adjustedAmount),
        slippage: Number(config?.SLIPPAGE),
      };
      swaps.push(swap);
    } else {
      pc.warn("⚠️ Not enough USDC to buy", token);
    }
  }

  // Redeem from Yearn Vaults
  // --------------------------------------------------------------------------------
  // --------------------------------------------------------------------------------
  pc.success("📡 Yearn Redeem Data");

  try {
    const data = await redeemFromYearnBatched(yearnRedeems);
    if (data?.Approvals.length > 0) {
      pc.log("📡 Approvals");

      const approvals = data.Approvals;

      for (const approval of approvals) {
        approval.gasLimit = gasLimit;
        approval.gasPrice = gas;

        const approvalTx = await dexWallet.wallet.sendTransaction(approval);
        const broadcaster = await waitForTx(dexWallet.walletProvider, approvalTx?.hash, dexWallet.walletAddress);

        pc.log("📡 Approval broadcasted:", broadcaster);
      }
    }

    if (data?.Calldatas.length > 0) {
      pc.log("📡 Calldatas");

      const simulate = await router.callStatic.execute(data?.Calldatas, data?.TokensReturn, {
        gasLimit: gasLimit,
        gasPrice: gas,
      });

      pc.log("📡 Simulation successful:", simulate);

      if (!simulate) return pc.log("📡 Simulation failed");

      const tx = await router.execute(data?.Calldatas, data?.TokensReturn, {
        gasLimit: gasLimit,
        gasPrice: gas,
      });
      const broadcaster = await waitForTx(dexWallet.walletProvider, tx?.hash, dexWallet.walletAddress);

      pc.log("📡 Tx broadcasted:", broadcaster);
    }
  } catch (e) {
    pc.log(e);
  }

  if (swaps.length !== 0) {
    try {
      pc.success("🔄 Swaps");
      await batchSwap(swaps);
    } catch (e) {
      pc.log(e);
    }
  }

  // Deposit to Yearn Vaults
  // --------------------------------------------------------------------------------
  // --------------------------------------------------------------------------------
  pc.success("⚖️ Yearn Deposit Data\n");

  const yearnDeposits = [];

  for (const vault of Object.values(config?.YEARN_VAULTS)) {
    const vaultAsset = await getVaultAsset(String(vault), chainId);
    const assetContract = new ethers.Contract(vaultAsset, erc20Abi, dexWallet.wallet);

    const balance = await assetContract.balanceOf(dexWallet.walletAddress);

    if (balance.gt(0)) {
      if (tokensToBuy.length == 0 && tokensToSell.length == 0) {
        pc.log("Deposit to Yearn Vaults", "Amount: ", Number(balance), "Vault: ", vaultAsset);
        const data: TDeposit = {
          wallet: dexWallet.wallet,
          tokenAddr: vaultAsset,
          pool: String(vault),
          amount: balance,
          receiver: dexWallet.walletAddress,
          chainId: config?.SELECTED_CHAINID,
        };
        yearnDeposits.push(data);
      }
    }
  }

  try {
    const data = await depositToYearnBatched(yearnDeposits);

    if (data?.Approvals.length > 0) {
      pc.log("📡 Approvals");

      const approvals = data.Approvals;

      for (const approval of approvals) {
        approval.gasLimit = gasLimit;
        approval.gasPrice = gas;
        const approvalTx = await dexWallet.wallet.sendTransaction(approval);
        const broadcaster = await waitForTx(dexWallet.walletProvider, approvalTx?.hash, dexWallet.walletAddress);
        pc.log("📡 Approval broadcasted:", broadcaster);
      }
    }

    if (data?.Calldatas.length > 0) {
      pc.log("📡 Calldatas");

      const simulate = await router.callStatic.execute(data?.Calldatas, data?.TokensReturn, {
        gasLimit: gasLimit,
        gasPrice: gas,
      });

      if ((await simulate) === false) return pc.log("📡 Simulation failed");
      pc.log("📡 Simulation successful:", await simulate);

      if (!simulate) return pc.log("📡 Simulation failed");

      const calldata = router.interface.encodeFunctionData("execute", [data.Calldatas, data.TokensReturn]);

      const tx = {
        to: router.address,
        value: 0,
        data: calldata,
        gasLimit: gasLimit,
        gasPrice: gas,
      };

      const executeTx = await dexWallet.wallet.sendTransaction(tx);
      const broadcaster = await waitForTx(dexWallet.walletProvider, executeTx?.hash, dexWallet.walletAddress);
      pc.log("📡 Tx broadcasted:", broadcaster);
    }
  } catch (e) {
    pc.log(e);
  }

  pc.success("✔️ Rebalance completed.");
}
