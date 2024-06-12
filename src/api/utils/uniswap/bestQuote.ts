import { BigNumber, Contract, ethers, Wallet } from 'ethers'
import {
  NATIVETOKENS,
  WETH,
  PROTOCOLS,
  USDC,
  DAI,
  USDT,
  NETWORKS,
} from '../../constants' // Assuming these constants are defined correctly
import { parseUnits } from 'ethers/lib/utils'
import erc20Abi from '../../abis/common/ERC20.json'
import quoterAbi from '../../abis/uniswap/Quoter.json'
import factoryAbi from '../../abis/uniswap/Factory.json'
import poolAbi from '../../abis/uniswap/Pool.json'
import {
  AlphaRouter,
  CurrencyAmount,
  SwapType,
} from '@uniswap/smart-order-router'
import { Percent, TradeType } from '@uniswap/sdk-core'
import { parseToken } from './parseToken'
import { Protocol } from '@uniswap/router-sdk'

const POOL_FEES = [100, 500, 3000, 10000]

const ZERO_ADDRESS = ethers.constants.AddressZero

function logError(context: string, error: any) {
  console.error(`Error in ${context}:`, error)
}

export function getAdjAmount(_amount: string, _decimals: number) {
  return parseUnits(_amount, _decimals)
}

async function findPoolAndFee(
  factoryContract: Contract,
  tokenIn: string,
  tokenOut: string
): Promise<number> {
  for (const poolFee of POOL_FEES) {
    const poolAddress = await getPoolAddress(
      factoryContract,
      tokenIn,
      tokenOut,
      poolFee
    )
    if (poolAddress !== ZERO_ADDRESS) return poolFee
  }
  return 0
}

async function getPoolAddress(
  factoryContract: Contract,
  tokenIn: string,
  tokenOut: string,
  poolFee: number
) {
  const poolAddress = await factoryContract.getPool(tokenIn, tokenOut, poolFee)
  return poolAddress
}

async function getAmountOut(
  quoterContract: Contract,
  tokenIn: string,
  tokenOut: string,
  poolFee: number,
  amountIn: BigNumber,
  slippage: number
): Promise<BigNumber> {
  try {
    const expectedAmountOut =
      await quoterContract.callStatic.quoteExactInputSingle(
        tokenIn,
        tokenOut,
        poolFee,
        amountIn.toString(),
        0
      )
    return expectedAmountOut.mul(10000 - slippage).div(10000)
  } catch (error) {
    logError('::API:: getAmountOut', error)
    return BigNumber.from(0)
  }
}

async function isSwapPossible(
  factoryContract: Contract,
  tokenIn: string,
  tokenOut: string,
  poolFee: number
): Promise<boolean> {
  const poolAddress = await factoryContract.getPool(tokenIn, tokenOut, poolFee)
  return poolAddress !== ZERO_ADDRESS
}

async function getPoolData(poolContract, minRequiredLiquidity) {
  const slot0 = await poolContract.slot0()
  //const currentSqrtPriceX96 = slot0.sqrtPriceX96
  const currentTick = slot0.tick
  const tickSpacing = await poolContract.tickSpacing()
  const desiredTickLower = currentTick - (currentTick % tickSpacing)
  const desiredTickUpper = desiredTickLower + tickSpacing
  const tickLowerData = await poolContract.ticks(desiredTickLower)
  const tickUpperData = await poolContract.ticks(desiredTickUpper)

  const liquidityInLowerTick = tickLowerData.liquidityGross
  const liquidityInUpperTick = tickUpperData.liquidityGross

  const isLiquiditySufficient =
    liquidityInLowerTick.gt(minRequiredLiquidity) &&
    liquidityInUpperTick.gt(minRequiredLiquidity)

  return isLiquiditySufficient
}

async function quoteSwapAmountOut(
  factoryContract: Contract,
  quoterContract: Contract,
  tokenIn: string,
  tokenOut: string,
  amountIn: BigNumber,
  slippageTolerance: number
): Promise<{ amountOut: BigNumber; poolFee: number }> {
  const poolFee = await findPoolAndFee(factoryContract, tokenIn, tokenOut)

  if (poolFee === 0) {
    console.log(
      'Nessuna pool adatta trovata, evitando la chiamata che fallirebbe.'
    )
    return { amountOut: BigNumber.from(0), poolFee: 0 }
  }

  // Verifica se la swap è possibile prima di procedere
  const swapPossible = await isSwapPossible(
    factoryContract,
    tokenIn,
    tokenOut,
    poolFee
  )
  if (!swapPossible) {
    console.log('La swap non è possibile, evitando la chiamata che fallirebbe.')
    return { amountOut: BigNumber.from(0), poolFee }
  }

  const amountOut = await getAmountOut(
    quoterContract,
    tokenIn,
    tokenOut,
    poolFee,
    amountIn,
    slippageTolerance
  )

  if (amountOut == BigNumber.from(0)) {
    return { amountOut: BigNumber.from(0), poolFee }
  }

  const poolAddress = await getPoolAddress(
    factoryContract,
    tokenIn,
    tokenOut,
    poolFee
  )

  const poolContract = new Contract(
    poolAddress,
    poolAbi,
    quoterContract.provider
  )

  const minimalLiquidity = getPoolData(poolContract, amountOut)

  if (!minimalLiquidity) {
    return { amountOut: BigNumber.from(0), poolFee }
  }

  return { amountOut, poolFee }
}

export async function getBestQuoteForSwapPath(
  factoryContract: Contract,
  quoterContract: Contract,
  tokenIn: string,
  tokenOut: string,
  amountIn: BigNumber,
  slippageTolerance: number,
  chainId: string
): Promise<{ amountOut: BigNumber; path: string[]; poolFees: number[] }> {
  let bestQuote = await quoteSwapAmountOut(
    factoryContract,
    quoterContract,
    tokenIn,
    tokenOut,
    amountIn,
    slippageTolerance
  )

  let bestPath = [tokenIn, tokenOut]

  // Check through intermediate tokens if direct path isn't the best
  const intermediateTokens = [
    NATIVETOKENS[chainId]?.WRAPPED,
    WETH[chainId],
    DAI[chainId],
    USDT[chainId],
    USDC[chainId],
  ].filter(token => token !== tokenIn && token !== tokenOut)

  for (const intermediateToken of intermediateTokens) {
    const toIntermediateQuote = await quoteSwapAmountOut(
      factoryContract,
      quoterContract,
      tokenIn,
      intermediateToken,
      amountIn,
      slippageTolerance
    )

    if (toIntermediateQuote.amountOut.isZero()) continue

    const fromIntermediateQuote = await quoteSwapAmountOut(
      factoryContract,
      quoterContract,
      intermediateToken,
      tokenOut,
      toIntermediateQuote.amountOut,
      slippageTolerance
    )

    if (fromIntermediateQuote.amountOut.gt(bestQuote.amountOut)) {
      bestQuote = fromIntermediateQuote
      bestPath = [tokenIn, intermediateToken, tokenOut]
    }
  }

  console.log('::DEBUG:: final bestQuote:', bestQuote)
  console.log('::DEBUG:: final bestPath:', bestPath)

  return {
    amountOut: bestQuote.amountOut,
    path: bestPath,
    poolFees: [bestQuote.poolFee],
  }
}

export async function getBestQuote(
  wallet: Wallet,
  token0: string,
  token1: string,
  reverse: boolean,
  protocol: string,
  chainId: string,
  amount: string,
  slippage: number
) {
  const _protocol = PROTOCOLS[chainId][protocol]
  const quoter = String(_protocol.QUOTER)
  const quoterContract = new Contract(quoter, quoterAbi, wallet)
  const factory = String(_protocol.FACTORY)
  const factoryContract = new Contract(factory, factoryAbi, wallet)
  const tokenAAddress = reverse ? token1 : token0
  const tokenAContract = new Contract(tokenAAddress, erc20Abi, wallet)
  const tokenADecimals = await tokenAContract.decimals()
  const tokenBAddress = reverse ? token0 : token1
  const adjAmount = getAdjAmount(Number(amount).toPrecision(18), tokenADecimals)

  const bestQuote = await getBestQuoteForSwapPath(
    factoryContract,
    quoterContract,
    tokenAAddress,
    tokenBAddress,
    adjAmount,
    slippage,
    chainId
  )

  console.log('::DEBUG:: final bestQuote:', bestQuote)

  return bestQuote
}

interface Token {
  address: string
  decimals: number
  symbol: string
  name: string
}

interface TradeRequest {
  chainId: number
  recipient: string
  amount: BigNumber
  tradeType: number
  currencyAmount: Token
  currency: Token
  slippage: number
}

export async function route(tradeRequest: TradeRequest) {
  console.log('::API::UNISWAP::ROUTE')

  const alphaRouter = new AlphaRouter({
    chainId: tradeRequest.chainId,
    provider: new ethers.providers.JsonRpcProvider(
      NETWORKS[tradeRequest.chainId]
    ),
  })

  const currencyAmount = parseToken(
    tradeRequest.currencyAmount,
    tradeRequest.chainId
  )

  const currency = parseToken(tradeRequest.currency, tradeRequest.chainId)

  const SLIPPAGE = new Percent(tradeRequest.slippage, 10_000)

  const routing = alphaRouter.route(
    CurrencyAmount.fromRawAmount(currencyAmount, Number(tradeRequest.amount)),
    currency,
    TradeType.EXACT_INPUT,
    {
      slippageTolerance: SLIPPAGE,
      type: SwapType.SWAP_ROUTER_02, // SwapType.UNIVERSAL_ROUTER
      recipient: tradeRequest.recipient,
      deadline: Math.floor(Date.now() / 1000) + 360,
      //deadlineOrPreviousBlockhash: Math.floor(Date.now() / 1000) + 360,
    },
    {
      distributionPercent: 10,
      maxSplits: 3,
      protocols: [Protocol.V3, Protocol.V2, Protocol.MIXED],
    }
  )

  return routing
}
