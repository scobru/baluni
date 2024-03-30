import { BigNumber, Contract, ethers } from 'ethers'
import { DexWallet } from '../../utils/web3/dexWallet'
import { formatEther, formatUnits } from 'ethers/lib/utils'
import { fetchPrices } from '../../utils/quote1Inch'
import { getTokenMetadata } from '../../utils/getTokenMetadata'
import { getTokenBalance } from '../../utils/getTokenBalance'
import { getTokenValue } from '../../utils/getTokenValue'
import { getRSI } from '../../features/ta/getRSI'
import { batchSwap } from '../../common/uniswap/batchSwap'
import { waitForTx } from '../../utils/web3/networkUtils'
import { INFRA } from 'baluni-api'
import {
  depositToYearnBatched,
  redeemFromYearnBatched,
  accuredYearnInterest,
  getVaultAsset,
} from 'baluni-api'
import routerAbi from 'baluni-api/dist/abis/infra/Router.json'
import erc20Abi from 'baluni-api/dist/abis/common/ERC20.json'
import * as config from './config.json'
import * as blocks from '../../utils/logBlocks'

type Tswap = {
  dexWallet: DexWallet
  token0: string
  token1: string
  reverse: boolean
  protocol: string
  chainId: number
  amount: string
  slippage: number
}

type TDeposit = {
  wallet: ethers.Wallet
  tokenAddr: string
  pool: string
  amount: BigNumber
  receiver: string
  chainId: string
}

type TRedeem = {
  wallet: ethers.Wallet
  pool: string
  amount: BigNumber
  receiver: string
  chainId: string
}

export async function getTokenValueEnhanced(
  tokenSymbol: string,
  token: string,
  tokenBalance: BigNumber,
  decimals: number,
  usdcAddress: string,
  yearnBalance?: BigNumber,
  interestAccrued?: any,
  chainId?: any
) {
  let effectiveBalance = tokenBalance
  if (config?.YEARN_ENABLED && yearnBalance) {
    effectiveBalance = yearnBalance.add(interestAccrued).add(tokenBalance)
  }

  return tokenSymbol === 'USDC.E' || tokenSymbol === 'USDC'
    ? effectiveBalance.mul(1e12)
    : await getTokenValue(
        tokenSymbol,
        token,
        effectiveBalance,
        decimals,
        usdcAddress,
        chainId
      )
}

export async function rebalancePortfolio(
  dexWallet: DexWallet,
  desiredTokens: string[],
  desiredAllocations: { [token: string]: number },
  usdcAddress: string,
  config: any
) {
  blocks.print2block()

  console.log('⚖️  Rebalance Portfolio\n')

  const gasLimit = 10000000
  const gas = await dexWallet?.walletProvider?.getGasPrice()

  const swapsSell: Tswap[] = []
  const swapsBuy: Tswap[] = []

  const chainId = dexWallet.walletProvider.network.chainId
  const infraRouter = INFRA[chainId].ROUTER

  const router = new ethers.Contract(infraRouter, routerAbi, dexWallet.wallet)

  let totalPortfolioValue = BigNumber.from(0)
  let tokenValues: { [token: string]: BigNumber } = {}

  console.log(
    `🏦 Total Portfolio Value (in USDT) at Start: ${String(
      formatEther(totalPortfolioValue)
    )}`
  )

  // Calculate Total Portfolio Value
  // --------------------------------------------------------------------------------
  // --------------------------------------------------------------------------------
  blocks.print1block()

  console.log('📊 Calculate Total Portfolio Value')

  for (const token of desiredTokens) {
    let tokenValue

    const tokenContract = new ethers.Contract(token, erc20Abi, dexWallet.wallet)

    const tokenMetadata = await getTokenMetadata(
      token,
      dexWallet.walletProvider
    )

    const _tokenbalance = await getTokenBalance(
      dexWallet.walletProvider,
      dexWallet.walletAddress,
      token
    )

    const tokenBalance = _tokenbalance.balance
    const decimals = tokenMetadata.decimals

    const tokenSymbol = await tokenContract?.symbol()
    const yearnVaultAddress = config?.YEARN_VAULTS[tokenSymbol]

    if (yearnVaultAddress !== undefined) {
      const yearnContract = new ethers.Contract(
        yearnVaultAddress,
        erc20Abi,
        dexWallet.wallet
      )

      const yearnBalance = await yearnContract?.balanceOf(
        dexWallet.walletAddress
      )

      const interestAccrued = await accuredYearnInterest(
        yearnVaultAddress,
        dexWallet.walletAddress,
        chainId
      )

      tokenValue = await getTokenValueEnhanced(
        tokenSymbol,
        token,
        tokenBalance,
        decimals,
        usdcAddress,
        yearnBalance,
        interestAccrued,
        chainId
      )

      tokenValues[token] = tokenValue
      totalPortfolioValue = totalPortfolioValue.add(tokenValue)
    } else {
      tokenValue = await getTokenValue(
        tokenSymbol,
        token,
        tokenBalance,
        decimals,
        config?.USDC,
        String(chainId)
      )
      tokenValues[token] = tokenValue
      totalPortfolioValue = totalPortfolioValue.add(tokenValue)
    }
  }

  console.log(
    `🏦 Total Portfolio Value (in USDT): ", ${String(
      formatEther(totalPortfolioValue)
    )}`
  )

  let currentAllocations: { [token: string]: number } = {}

  let tokensToSell = []
  let tokensToBuy = []

  Object.keys(tokenValues).forEach(token => {
    currentAllocations[token] = tokenValues[token]
      .mul(10000)
      .div(totalPortfolioValue)
      .toNumber() // Store as percentage
  })

  // Rebalance
  // --------------------------------------------------------------------------------
  // --------------------------------------------------------------------------------
  blocks.print1block()
  console.log('📊 Rebalance Portfolio')
  for (const token of desiredTokens) {
    const currentAllocation = currentAllocations[token]
    const desiredAllocation = desiredAllocations[token]

    const difference = desiredAllocation - currentAllocation
    const tokenMetadata = await getTokenMetadata(
      token,
      dexWallet.walletProvider
    )

    const _tokenBalance = await getTokenBalance(
      dexWallet.walletProvider,
      dexWallet.walletAddress,
      token
    )
    const tokenSymbol: string = tokenMetadata.symbol as string

    const yearnVaultAddress = config?.YEARN_VAULTS[tokenSymbol]

    let tokenBalance = _tokenBalance.balance

    if (yearnVaultAddress !== undefined) {
      const yearnContract = new ethers.Contract(
        yearnVaultAddress,
        erc20Abi,
        dexWallet.wallet
      )
      const yearnBalance = await yearnContract?.balanceOf(
        dexWallet.walletAddress
      )
      tokenBalance = _tokenBalance.balance.add(yearnBalance)
    }
    const valueToRebalance = totalPortfolioValue
      .mul(BigNumber.from(Math.abs(difference)))
      .div(10000)

    console.group(`🪙  Token: ${token}`)
    console.log(`📊 Current Allocation: ${currentAllocation}%`)
    console.log(`💰 Difference: ${difference}%`)
    console.log(`💲 Value (USD): ${formatEther(tokenValues[token])}`)
    console.log(
      `⚖️  Value to Rebalance (USD): ${formatEther(valueToRebalance)}`
    )
    console.log(`👛 Balance: ${formatEther(tokenBalance)} ${tokenSymbol}`)
    console.groupEnd()

    if (difference < 0 && Math.abs(difference) > config?.LIMIT) {
      // const tokenPriceInUSDT = await quotePair(token, usdcAddress);
      const tokenMetadata = await getTokenMetadata(
        token,
        dexWallet?.walletProvider
      )
      const decimals = tokenMetadata.decimals

      const _token = {
        address: token,
        decimals: decimals,
      }
      const tokenPriceInUSDT: number = await fetchPrices(
        _token,
        String(chainId)
      ) // Ensure this returns a value

      const pricePerToken = ethers.utils.parseUnits(
        tokenPriceInUSDT!.toString(),
        'ether'
      )
      const tokenAmountToSell = valueToRebalance
        .mul(BigNumber.from(10).pow(decimals))
        .div(pricePerToken)
      if (token === usdcAddress) {
        console.log('SKIP USDC SELL')
        break
      }
      tokensToSell.push({ token, amount: tokenAmountToSell })
    } else if (difference > 0 && Math.abs(difference) > config?.LIMIT) {
      if (token === usdcAddress) {
        console.log('SKIP USDC SELL')
        break
      }
      tokensToBuy.push({ token, amount: valueToRebalance.div(1e12) })
    }

    blocks.printline()
  }

  // Sell Tokens
  // --------------------------------------------------------------------------------
  // --------------------------------------------------------------------------------
  blocks.print1block()
  console.log('🔄 Sell Tokens')
  const yearnRedeems = []
  let i = 0
  for (let { token, amount: amountWei } of tokensToSell) {
    try {
      const tokenContract = new Contract(token, erc20Abi, dexWallet.wallet)
      const tokenSymbol = await tokenContract.symbol()

      const tokenDecimal = await tokenContract.decimals()
      const pool = config?.YEARN_VAULTS[tokenSymbol]

      console.log(
        `🔴 Selling ${formatUnits(
          amountWei,
          tokenDecimal
        )} worth of ${tokenSymbol}`
      )

      let intAmount = Number(formatUnits(amountWei, tokenDecimal))

      // Redeem from Yearn Vaults
      if (pool !== undefined && pool !== config?.YEARN_VAULTS.USDC) {
        const balance = await getTokenBalance(
          dexWallet.walletProvider,
          dexWallet.walletAddress,
          token
        )

        const yearnCtx = new ethers.Contract(pool, erc20Abi, dexWallet.wallet)
        const yearnCtxBal = await yearnCtx?.balanceOf(dexWallet.walletAddress)

        if (
          Number(amountWei) < Number(await balance.balance) &&
          Number(yearnCtxBal) >= Number(amountWei)
        ) {
          console.log('Redeem from Yearn')

          const data: TRedeem = {
            wallet: dexWallet.wallet,
            pool: pool,
            amount: yearnCtxBal,
            receiver: dexWallet.walletAddress,
            chainId: String(chainId),
          }
          yearnRedeems.push(data)
        } else if (Number(yearnCtxBal) > Number(0)) {
          console.log('Redeem from Yearn')

          const data: TRedeem = {
            wallet: dexWallet.wallet,
            pool: pool,
            amount: yearnCtxBal,
            receiver: dexWallet.walletAddress,
            chainId: String(chainId),
          }
          yearnRedeems.push(data)
        }
      }

      const [rsiResult, stochasticRSIResult] = await getRSI(tokenSymbol, config)
      const balance = (
        await getTokenBalance(
          dexWallet.walletProvider,
          dexWallet.walletAddress,
          token
        )
      ).balance

      // Sell token if RSI and StochRSI are overbought
      if (Number(amountWei) < balance) {
        if (
          stochasticRSIResult.stochRSI > config?.STOCKRSI_OVERBOUGHT &&
          rsiResult.rsiVal > config?.RSI_OVERBOUGHT &&
          config?.TECNICAL_ANALYSIS
        ) {
          const tokenSymbol = await tokenContract.symbol()
          console.log('Condition met for selling', tokenSymbol)

          const swap: Tswap = {
            dexWallet,
            token0: tokenSymbol,
            token1: 'USDC.E',
            reverse: false,
            protocol: config?.SELECTED_PROTOCOL,
            chainId: config?.SELECTED_CHAINID,
            amount: String(intAmount),
            slippage: Number(config?.SLIPPAGE),
          }

          swapsSell.push(swap)
        } else if (!config?.TECNICAL_ANALYSIS) {
          const swap: Tswap = {
            dexWallet: dexWallet,
            token0: tokenSymbol,
            token1: 'USDC.E',
            reverse: false,
            protocol: config?.SELECTED_PROTOCOL,
            chainId: config?.SELECTED_CHAINID,
            amount: String(intAmount),
            slippage: Number(config?.SLIPPAGE),
          }
          swapsSell.push(swap)
        } else {
          console.warn('⚠️ Waiting for StochRSI overBought')
        }
      }

      i++
      blocks.printline()
    } catch (e) {
      console.log(e)
    }
  }

  // Buy Tokens
  // --------------------------------------------------------------------------------
  // --------------------------------------------------------------------------------
  blocks.print1block()
  console.log('🔄 Buy Tokens')

  const poolAddress = config?.YEARN_VAULTS.USDC
  const poolCtx = new ethers.Contract(poolAddress, erc20Abi, dexWallet.wallet)
  const yBalUSDC = await poolCtx?.balanceOf(dexWallet.walletAddress)
  const balUSD: BigNumber = await (
    await getTokenBalance(
      dexWallet.walletProvider,
      dexWallet.walletAddress,
      config?.USDC
    )
  )?.balance
  let totalAmount = BigNumber.from(0)
  let totalAmountWei = BigNumber.from(0)

  i = 0

  tokensToBuy.forEach(token => {
    totalAmountWei = totalAmountWei.add(token.amount)
  })

  for (let { token, amount: amountWei } of tokensToBuy) {
    if (token === usdcAddress) {
      console.log('SKIP USDC BUY')
      break
    }
    console.log(`🟩 Buying ${Number(amountWei) / 1e6} USDC worth of ${token}`)
    const tokenCtx = new Contract(token, erc20Abi, dexWallet.wallet)
    const tokenSym = await tokenCtx.symbol()
    const intAmount = Number(formatUnits(amountWei, 6))
    const [rsiResult, stochasticRSIResult] = await getRSI(tokenSym, config)
    const balUSD: BigNumber = await (
      await getTokenBalance(
        dexWallet.walletProvider,
        dexWallet.walletAddress,
        config?.USDC
      )
    )?.balance
    const isTechnicalAnalysisConditionMet =
      stochasticRSIResult.stochRSI < config?.STOCKRSI_OVERSOLD &&
      rsiResult.rsiVal < config?.RSI_OVERSOLD

    if (isTechnicalAnalysisConditionMet || !config?.TECNICAL_ANALYSIS) {
      const tokenSym = await tokenCtx.symbol()
      console.log('Condition met for buying', tokenSym)

      const swap: Tswap = {
        dexWallet: dexWallet,
        token0: tokenSym,
        token1: 'USDC.E',
        reverse: true,
        protocol: config?.SELECTED_PROTOCOL,
        chainId: config?.SELECTED_CHAINID,
        amount: String(intAmount),
        slippage: Number(config?.SLIPPAGE),
      }
      swapsBuy.push(swap)
      totalAmount = totalAmount.add(amountWei)
    } else {
      console.warn('⚠️ Waiting for StochRSI overSold')
    }

    i++
    blocks.printline()
  }

  console.log('🟩 USDC Balance: ', formatUnits(balUSD, 6))
  console.log('🟩 Yearn USDC Balance: ', formatUnits(yBalUSDC, 6))

  // Redeem USDC from Yearn Vaults
  if (tokensToBuy.length > 0 && yBalUSDC.gt(0)) {
    console.log('Redeem from Yearn Vaults')
    const data: TRedeem = {
      wallet: dexWallet.wallet,
      pool: poolAddress,
      amount: yBalUSDC,
      receiver: dexWallet.walletAddress,
      chainId: String(chainId),
    }
    yearnRedeems.push(data)
  }

  // Redeem from Yearn Vaults
  // --------------------------------------------------------------------------------
  // --------------------------------------------------------------------------------
  blocks.print1block()
  console.log('📡 Yearn Redeem Data')
  try {
    const data = await redeemFromYearnBatched(yearnRedeems)
    if (data?.Approvals.length > 0) {
      console.log('📡 Approvals')

      const approvals = data.Approvals
      for (const approval of approvals) {
        approval.gasLimit = gasLimit
        approval.gasPrice = gas

        const approvalTx = await dexWallet.wallet.sendTransaction(approval)
        const broadcaster = await waitForTx(
          dexWallet.walletProvider,
          approvalTx?.hash,
          dexWallet.walletAddress
        )

        console.log(`📡 Approval broadcasted: ${broadcaster}`)
      }
    }

    if (data?.Calldatas.length > 0) {
      console.log('📡 Calldatas')
      const simulate = await router.callStatic.execute(
        data?.Calldatas,
        data?.TokensReturn,
        {
          gasLimit: gasLimit,
          gasPrice: gas,
        }
      )

      console.log(`📡  Simulation successful:: ${simulate}`)
      if (!simulate) return console.log('📡 Simulation failed')

      const tx = await router.execute(data?.Calldatas, data?.TokensReturn, {
        gasLimit: gasLimit,
        gasPrice: gas,
      })
      const broadcaster = await waitForTx(
        dexWallet.walletProvider,
        tx?.hash,
        dexWallet.walletAddress
      )
      console.log(`📡  Tx broadcasted:: ${broadcaster}`)
    }
  } catch (e) {
    console.log(e)
  }

  /*  const swapsArray = swapsSell.concat(swapsBuy);

  if (swapsArray.length !== 0) {
    try {
      console.log("🔄 Swaps");
      await batchSwap(swapsArray);
    } catch (e) {
      console.log(e);
    }
  } */

  if (swapsSell.length !== 0) {
    try {
      console.log('🔄 Swaps')
      await batchSwap(swapsSell)
    } catch (e) {
      console.log(e)
    }
  }

  if (swapsBuy.length !== 0) {
    try {
      console.log('🔄 Swaps')
      await batchSwap(swapsBuy)
    } catch (e) {
      console.log(e)
    }
  }

  // Deposit to Yearn Vaults
  // --------------------------------------------------------------------------------
  // --------------------------------------------------------------------------------
  console.log('⚖️ Yearn Deposit Data\n')
  blocks.print1block()

  const yearnDeposits = []

  for (const vault of Object.values(config?.YEARN_VAULTS)) {
    const vaultAsset = await getVaultAsset(String(vault), chainId)
    const assetContract = new ethers.Contract(
      vaultAsset,
      erc20Abi,
      dexWallet.wallet
    )

    const balance = await assetContract.balanceOf(dexWallet.walletAddress)

    if (balance.gt(0)) {
      if (tokensToBuy.length == 0 && tokensToSell.length == 0) {
        console.log(
          `Deposit to Yearn Vaults Amount: ${Number(
            balance
          )}, Vault:  ${vaultAsset}`
        )
        const data: TDeposit = {
          wallet: dexWallet.wallet,
          tokenAddr: vaultAsset,
          pool: String(vault),
          amount: balance,
          receiver: dexWallet.walletAddress,
          chainId: config?.SELECTED_CHAINID,
        }
        yearnDeposits.push(data)
      }
    }
  }

  try {
    const data = await depositToYearnBatched(yearnDeposits)

    if (data?.Approvals.length > 0) {
      console.log('📡 Approvals')

      const approvals = data.Approvals

      for (const approval of approvals) {
        approval.gasLimit = gasLimit
        approval.gasPrice = gas
        const approvalTx = await dexWallet.wallet.sendTransaction(approval)
        const broadcaster = await waitForTx(
          dexWallet.walletProvider,
          approvalTx?.hash,
          dexWallet.walletAddress
        )

        console.log(`📡 Approval broadcasted: ${broadcaster}`)
      }
    }

    if (data?.Calldatas.length > 0) {
      console.log('📡 Calldatas')

      const simulate = await router.callStatic.execute(
        data?.Calldatas,
        data?.TokensReturn,
        {
          gasLimit: gasLimit,
          gasPrice: gas,
        }
      )

      if ((await simulate) === false) return console.log('📡 Simulation failed')

      console.log(`📡  Simulation successful:: ${simulate}`)

      if (!simulate) return console.log('📡 Simulation failed')

      const calldata = router.interface.encodeFunctionData('execute', [
        data.Calldatas,
        data.TokensReturn,
      ])

      const tx = {
        to: router.address,
        value: 0,
        data: calldata,
        gasLimit: gasLimit,
        gasPrice: gas,
      }

      const executeTx = await dexWallet.wallet.sendTransaction(tx)
      const broadcaster = await waitForTx(
        dexWallet.walletProvider,
        executeTx?.hash,
        dexWallet.walletAddress
      )
      console.log(`📡 Tx broadcasted:: ${broadcaster}`)
    }
  } catch (e) {
    console.log(e)
  }

  blocks.print1starry()
  console.log('✔️ Rebalance completed.')
}
