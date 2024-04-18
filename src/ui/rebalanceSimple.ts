interface RebalanceStats {
  totalPortfolioValue: BigNumber
  currentAllocations: { [token: string]: number }
  adjustments: Array<{
    token: string
    action: string
    differencePercentage: number
    valueToRebalance: BigNumber
  }>
}

import erc20Abi from 'baluni-api/dist/abis/common/ERC20.json'
import { DexWallet } from '../utils/web3/dexWallet'
import { getTokenBalance } from '../utils/getTokenBalance'
import { getTokenMetadata } from '../utils/getTokenMetadata'
import { getTokenValue } from '../utils/getTokenValue'
import { fetchPrices } from '../utils/quote1Inch'
import { BigNumber, Contract, ethers } from 'ethers'
import { formatEther, formatUnits } from 'ethers/lib/utils'
import { updateConfig } from './updateConfig'
import { TConfigReturn } from '../types/config'
import { Tswap } from '../types/uniswap'
import { batchSwap } from '../common/uniswap/batchSwap'

let config: TConfigReturn

export async function rebalancePortfolio(
  dexWallet: DexWallet,
  desiredTokens: string[],
  desiredAllocations: { [token: string]: number },
  usdcAddress: string,
  walletProvider: ethers.providers.JsonRpcProvider
) {
  config = await updateConfig(
    desiredTokens,
    desiredAllocations,
    walletProvider.network.chainId,
    false,
    {},
    0,
    false,
    false
  )

  console.log(
    '**************************************************************************'
  )
  console.log('⚖️  Rebalance Portfolio\n', '🔋 Check Gas and Recharge\n')

  const _usdBalance = await getTokenBalance(
    dexWallet.walletProvider,
    dexWallet.walletAddress,
    usdcAddress
  )
  let usdBalance = _usdBalance.balance
  let totalPortfolioValue = BigNumber.from(0)

  console.log(
    '🏦 Total Portfolio Value (in USDT) at Start: ',
    formatEther(totalPortfolioValue)
  )

  const swapsSell: Tswap[] = []
  const swapsBuy: Tswap[] = []
  const tokenValues: { [token: string]: BigNumber } = {}
  const provider = walletProvider

  // First, calculate the current value of each token in the portfolio
  for (const token of desiredTokens) {
    const tokenContract = new ethers.Contract(token, erc20Abi, provider)
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
    const tokenSymbol = await tokenContract.symbol()
    const tokenValue = await getTokenValue(
      tokenSymbol,
      token,
      tokenBalance,
      decimals,
      usdcAddress,
      String(dexWallet.walletProvider.network.chainId)
    )
    tokenSymbol == 'USDC' ? tokenValue.mul(1e12) : tokenValue
    tokenValues[token] = tokenValue
    totalPortfolioValue = totalPortfolioValue.add(tokenValue)
  }

  console.log(
    '🏦 Total Portfolio Value (in USDT): ',
    formatEther(totalPortfolioValue)
  )

  // Calculate the current allocations
  const currentAllocations: { [token: string]: number } = {}

  Object.keys(tokenValues).forEach(token => {
    currentAllocations[token] = tokenValues[token]
      .mul(10000)
      .div(totalPortfolioValue)
      .toNumber() // Store as percentage
  })

  // Segregate tokens into sell and buy lists
  const tokensToSell = []
  const tokensToBuy = []

  // Find token to sell and buy
  for (const token of desiredTokens) {
    const currentAllocation = currentAllocations[token] // current allocation as percentage
    const desiredAllocation = desiredAllocations[token]
    const difference = desiredAllocation - currentAllocation // Calculate the difference for each token
    const tokenMetadata = await getTokenMetadata(
      token,
      dexWallet.walletProvider
    )
    const tokenDecimals = tokenMetadata.decimals

    const _tokenBalance = await getTokenBalance(
      dexWallet.walletProvider,
      dexWallet.walletAddress,
      token
    )
    const tokenBalance = _tokenBalance.balance
    const tokenSymbol = tokenMetadata.symbol
    console.log('tokenBalance', tokenBalance.toString())
    console.log('tokenSymbol', tokenSymbol)
    console.log('token', token)
    console.log('difference', difference)
    console.log('Current Allocation', currentAllocation)
    console.log('Desired Allocation', desiredAllocation)
    const valueToRebalance = totalPortfolioValue
      .mul(BigNumber.from(Math.abs(difference)))
      .div(10000) // USDT value to rebalance

    const formattedBalance = formatUnits(tokenBalance, tokenDecimals)
    console.group(`🪙  Token: ${token}`)
    console.log(`📊 Current Allocation: ${currentAllocation}%`)
    console.log(`💰 Difference: ${difference}%`)
    console.log(`💲 Value (USD): ${formatEther(tokenValues[token])}`)
    console.log(
      `⚖️  Value to Rebalance (USD): ${formatEther(valueToRebalance)}`
    )
    console.log(`👛 Balance: ${formattedBalance} ${tokenSymbol}`)
    console.groupEnd()

    if (difference < 0 && Math.abs(difference) > config?.LIMIT) {
      // Calculate token amount to sell
      //const tokenPriceInUSDT = await quotePair(token, usdcAddress);
      const tokenMetadata = await getTokenMetadata(
        token,
        dexWallet.walletProvider
      )
      const decimals = tokenMetadata.decimals
      const _token = {
        address: token,
        decimals: decimals,
      }

      const tokenPriceInUSDT: number = await fetchPrices(
        _token,
        String(walletProvider.network.chainId)
      ) // Ensure this returns a value
      const pricePerToken = ethers.utils.parseUnits(
        tokenPriceInUSDT!.toString(),
        'ether'
      )

      const tokenAmountToSell = valueToRebalance
        .mul(BigNumber.from(10).pow(decimals))
        .div(pricePerToken)

      tokensToSell.push({ token, amount: tokenAmountToSell })
    } else if (difference > 0 && Math.abs(difference) > config?.LIMIT) {
      // For buying, we can use valueToRebalance directly as we will be spending USDT
      tokensToBuy.push({ token, amount: valueToRebalance.div(1e12) })
    }
  }

  // Sell Tokens
  for (const { token, amount } of tokensToSell) {
    console.info(`🔴 Selling ${formatEther(amount)} worth of ${token}`)
    const tokenContract = new Contract(token, erc20Abi, dexWallet.wallet)

    const tokenSymbol = await tokenContract.symbol()
    const tokenDecimal = await tokenContract.decimals()

    const intAmount = Number(formatUnits(amount, tokenDecimal))

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
  }

  // Buy Tokens
  for (const { token, amount } of tokensToBuy) {
    if (token === usdcAddress) {
      console.log('SKIP USDC BUY')
      break
    }
    console.info(`🟩 Buying ${Number(amount) / 1e6} USDC worth of ${token}`)
    const _usdBalance = await getTokenBalance(
      dexWallet.walletProvider,
      dexWallet.walletAddress,
      usdcAddress
    )

    usdBalance = _usdBalance.balance
    const tokenCtx = new Contract(token, erc20Abi, dexWallet.wallet)
    const intAmount = Number(formatUnits(amount, 6))
    const tokenSym = await tokenCtx.symbol()

    if (usdBalance.gte(amount)) {
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
    } else {
      console.error(
        '✖️ Not enough USDT to buy, balance under 60% of required USD'
      )
    }
  }

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

  console.log('✔️ Rebalance completed.')
}

export async function calculateRebalanceStats(
  dexWallet: DexWallet,
  desiredTokens: string[],
  desiredAllocations: { [token: string]: number },
  usdcAddress: string,
  walletProvider: ethers.providers.JsonRpcProvider
) {
  try {
    console.log(
      '**************************************************************************'
    )
    console.log('📊 Calculating Rebalance Statistics')

    let totalPortfolioValue = BigNumber.from(0)
    const tokenValues: { [token: string]: BigNumber } = {}
    // Calculate the current value of each token in the portfolio
    for (const token of desiredTokens) {
      const tokenMetadata = await getTokenMetadata(token, walletProvider)
      const _tokenbalance = await getTokenBalance(
        walletProvider,
        dexWallet.walletAddress,
        token
      )
      const tokenBalance = _tokenbalance.balance
      console.log(tokenBalance)

      const tokenValue = await getTokenValue(
        tokenMetadata.symbol as string,
        token,
        tokenBalance,
        tokenMetadata.decimals,
        usdcAddress,
        String(walletProvider.network.chainId)
      )
      tokenValues[token] = tokenValue
      totalPortfolioValue = totalPortfolioValue.add(tokenValue)
    }

    console.log(
      '🏦 Total Portfolio Value (in USDT): ',
      formatEther(totalPortfolioValue)
    )

    // Calculate the current allocations
    const currentAllocations: { [token: string]: number } = {}
    Object.keys(tokenValues).forEach(token => {
      currentAllocations[token] = tokenValues[token]
        .mul(10000)
        .div(totalPortfolioValue)
        .toNumber() // Store as percentage
    })

    const rebalanceStats: RebalanceStats = {
      totalPortfolioValue: totalPortfolioValue,
      currentAllocations: currentAllocations,
      adjustments: [],
    }

    // Determine adjustments for rebalancing
    for (const token of desiredTokens) {
      const currentAllocation = currentAllocations[token]
      const desiredAllocation = desiredAllocations[token]
      const difference = desiredAllocation - currentAllocation
      const valueToRebalance = totalPortfolioValue
        .mul(BigNumber.from(Math.abs(difference)))
        .div(10000) // USDT value to rebalance

      if (Math.abs(difference) > 0) {
        rebalanceStats.adjustments.push({
          token: token,
          action: difference > 0 ? 'Buy' : 'Sell',
          differencePercentage: difference,
          valueToRebalance: valueToRebalance,
        })
      }
    }

    return rebalanceStats
  } catch (e) {
    return { error: e }
  }
}
