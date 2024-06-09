import { ethers, BigNumber } from 'ethers'
import { initializeWallet } from '../../../../utils/web3/dexWallet'
import { NETWORKS, NATIVETOKENS } from '../../../../../api'
import { getTokenMetadata } from '../../../../utils/getTokenMetadata'
import { getTokenBalance } from '../../../../utils/getTokenBalance'
import { formatUnits } from 'ethers/lib/utils.js'
import { OffChainOracleAbi } from '../../../../../api'
import config from './config.json'
import { batchSwap } from '../../../../common/uniswap/batchSwap'

// 🏦 This script executes a Dollar Cost Averaging (DCA) strategy
// based on price variations. It swaps a percentage of your balance
// from the native token of the selected chain to the selected token address.
// The percentage is determined based on price movements.

const offChainOracleAddress = '0x0AdDd25a91563696D8567Df78D5A01C9a991F9B8' // Polygon

// In-memory storage for tracking profits
let transactionHistory: { buyPrice: number; amount: BigNumber }[] = []
let startPrice: number | null = null
let lastPriceStep: number | null = null
const priceThresholdPercentage = 0.01 // Define the percentage threshold (e.g., 1%)
let forceInitialInvestment = true // Flag to force initial investment

// 🔍 Function to get the initial price
const getInitialPrice = async () => {
  const dexWallet = await initializeWallet(
    String(NETWORKS[config.SELECTED_CHAINID])
  )
  const offchainOracle = new ethers.Contract(
    offChainOracleAddress,
    OffChainOracleAbi,
    dexWallet.walletProvider
  )

  const fromTokenMetadata = await getTokenMetadata(
    config?.FROMADDRESS,
    dexWallet.walletProvider
  )
  const fromTokenDecimal = fromTokenMetadata.decimals

  const toTokenMetadata = await getTokenMetadata(
    config.TOADDRESS,
    dexWallet.walletProvider
  )
  const toTokenDecimal = toTokenMetadata.decimals

  const ETHdata = await offchainOracle
    .getRate(config?.FROMADDRESS, config.TOADDRESS, true)
    .then(rate => {
      const numerator = 10 ** fromTokenDecimal
      const denominator = 10 ** toTokenDecimal
      const price = (parseFloat(rate) * numerator) / denominator / 1e18
      return (1 / price).toString()
    })
    .catch(console.log)

  return parseFloat(ETHdata)
}

// 📈 Function to execute the DCA strategy
const initializeDCA = async () => {
  const dexWallet = await initializeWallet(
    String(NETWORKS[config.SELECTED_CHAINID])
  )
  const offchainOracle = new ethers.Contract(
    offChainOracleAddress,
    OffChainOracleAbi,
    dexWallet.walletProvider
  )
  const fromAddress = NATIVETOKENS[config?.SELECTED_CHAINID].WRAPPED
  const fromTokenMetadata = await getTokenMetadata(
    fromAddress,
    dexWallet.walletProvider
  )
  const toTokenMetadata = await getTokenMetadata(
    config.TOADDRESS,
    dexWallet.walletProvider
  )
  const _tokenBalance = await getTokenBalance(
    dexWallet.walletProvider,
    dexWallet.walletAddress,
    fromAddress
  )

  return {
    dexWallet,
    offchainOracle,
    fromTokenMetadata,
    toTokenMetadata,
    _tokenBalance,
  }
}

const calculateInvestment = (
  myBalance,
  CurrentETHPrice,
  firstStep,
  secondStep,
  thirdStep,
  forceInitialInvestment
) => {
  let amountIn: BigNumber
  if (forceInitialInvestment) {
    amountIn = myBalance.balance.div(BigNumber.from(20)) // Or any initial investment logic you prefer
    console.log(
      `📊 Initial Step: Investing ${formatUnits(amountIn)} ${myBalance.symbol}`
    )
  } else if (CurrentETHPrice >= secondStep && CurrentETHPrice <= firstStep) {
    if (lastPriceStep !== firstStep) {
      amountIn = myBalance.balance.div(BigNumber.from(20))
      lastPriceStep = firstStep
      console.log(
        `📊 First Step: Investing ${formatUnits(amountIn)} ${myBalance.symbol}`
      )
    } else {
      amountIn = BigNumber.from(0)
    }
  } else if (CurrentETHPrice >= thirdStep && CurrentETHPrice <= secondStep) {
    if (lastPriceStep !== secondStep) {
      amountIn = myBalance.balance.div(BigNumber.from(10))
      lastPriceStep = secondStep
      console.log(
        `📊 Second Step: Investing ${formatUnits(amountIn)} ${myBalance.symbol}`
      )
    } else {
      amountIn = BigNumber.from(0)
    }
  } else if (CurrentETHPrice < thirdStep) {
    if (lastPriceStep !== thirdStep) {
      amountIn = myBalance.balance.div(BigNumber.from(5))
      lastPriceStep = thirdStep
      console.log(
        `📊 Third Step: Investing ${formatUnits(amountIn)} ${myBalance.symbol}`
      )
    } else {
      amountIn = BigNumber.from(0)
    }
  } else {
    amountIn = BigNumber.from(0)
  }

  return amountIn
}

const executeSwapAndRecordTransaction = async (
  amountIn,
  dexWallet,
  fromTokenMetadata,
  toTokenMetadata,
  CurrentETHPrice
) => {
  if (amountIn.eq(BigNumber.from(0))) {
    console.log('🚫 No action required, skipping...')
    return
  }

  console.log(
    `💱 Executing swap: ${formatUnits(amountIn)} ${
      fromTokenMetadata.symbol
    } to ${toTokenMetadata.symbol} at price ${CurrentETHPrice}`
  )

  await batchSwap([
    {
      dexWallet: dexWallet,
      token0: fromTokenMetadata.symbol,
      token1: toTokenMetadata.symbol,
      reverse: false,
      protocol: config.SELECTED_PROTOCOL,
      chainId: config.SELECTED_CHAINID,
      amount: formatUnits(amountIn, toTokenMetadata.decimals),
      slippage: config.SLIPPAGE,
    },
  ])

  transactionHistory.push({
    buyPrice: CurrentETHPrice,
    amount: amountIn,
  })

  console.log(
    `📝 Transaction recorded: Bought at ${CurrentETHPrice}, Amount: ${formatUnits(
      amountIn
    )}`
  )

  await checkAndSellIfProfitable()
}

const executeDCA = async (forceInitialInvestment = false) => {
  const {
    dexWallet,
    offchainOracle,
    fromTokenMetadata,
    toTokenMetadata,
    _tokenBalance,
  } = await initializeDCA()

  const ETHdata = await offchainOracle
    .getRate(config?.FROMADDRESS, config.TOADDRESS, true)
    .then(rate => {
      const numerator = 10 ** fromTokenMetadata.decimals
      const denominator = 10 ** toTokenMetadata.decimals
      const price = (parseFloat(rate) * numerator) / denominator / 1e18
      return (1 / price).toString()
    })
    .catch(console.log)

  const CurrentETHPrice = parseFloat(ETHdata)

  const myBalance = _tokenBalance

  const firstStep = startPrice! * 0.998
  const secondStep = startPrice! * 0.95
  const thirdStep = startPrice! * 0.9

  console.log(`Current Price: ${CurrentETHPrice}, Start Price: ${startPrice}`)
  console.log(
    `Steps - First: ${firstStep}, Second: ${secondStep}, Third: ${thirdStep}`
  )

  const amountIn = calculateInvestment(
    myBalance,
    CurrentETHPrice,
    firstStep,
    secondStep,
    thirdStep,
    forceInitialInvestment
  )

  await executeSwapAndRecordTransaction(
    amountIn,
    dexWallet,
    fromTokenMetadata,
    toTokenMetadata,
    CurrentETHPrice
  )

  // Check if the current price exceeds the threshold percentage compared to the start price
  if (CurrentETHPrice > startPrice! * (1 + priceThresholdPercentage)) {
    startPrice = CurrentETHPrice
    console.log(
      `🔄 Start price updated to ${startPrice} due to significant increase`
    )
  }
}

// 🧮 Function to calculate profit
const calculateProfit = async () => {
  const dexWallet = await initializeWallet(
    String(NETWORKS[config.SELECTED_CHAINID])
  )

  const offchainOracle = new ethers.Contract(
    offChainOracleAddress,
    OffChainOracleAbi,
    dexWallet.walletProvider
  )

  const ETHdata = await offchainOracle
    .getRateToEth(config.TOADDRESS, true)
    .then(rate => {
      const numerator = 10 ** 18
      const denominator = 1e18
      const price = (parseFloat(rate) * numerator) / denominator / 1e18
      return (1 / price).toString()
    })
    .catch(console.log)

  const currentPrice = parseFloat(ETHdata)

  let totalProfit = 0
  transactionHistory.forEach(tx => {
    const profit =
      (currentPrice - tx.buyPrice) *
      parseFloat(ethers.utils.formatEther(tx.amount))
    totalProfit += profit
  })

  console.log(`💹 Calculated total profit: ${totalProfit}`)
  return totalProfit
}

// 🔄 Function to check and sell if profitable
const checkAndSellIfProfitable = async () => {
  const totalProfit = await calculateProfit()
  if (totalProfit > 0.001) {
    console.log('💹 Profit detected:', totalProfit, 'Executing sell...')

    const dexWallet = await initializeWallet(
      String(NETWORKS[config.SELECTED_CHAINID])
    )
    const _tokenBalance = await getTokenBalance(
      dexWallet.walletProvider,
      dexWallet.walletAddress,
      config.TOADDRESS
    )
    const toTokenMetadata = await getTokenMetadata(
      config.TOADDRESS,
      dexWallet.walletProvider
    )
    const toTokenDecimal = toTokenMetadata.decimals

    const fromTokenMetadata = await getTokenMetadata(
      NATIVETOKENS[config?.SELECTED_CHAINID].WRAPPED,
      dexWallet.walletProvider
    )

    await batchSwap([
      {
        dexWallet,
        token0: fromTokenMetadata.symbol,
        token1: toTokenMetadata.symbol,
        reverse: true,
        protocol: config.SELECTED_PROTOCOL,
        chainId: config.SELECTED_CHAINID,
        amount: formatUnits(_tokenBalance.balance, toTokenDecimal),
        slippage: config.SLIPPAGE,
      },
    ])

    console.log(`🧹 Cleared transaction history after selling`)
    // 🧹 Clear the transaction history after selling
    transactionHistory = []
    lastPriceStep = null // Reset the last price step after selling
  }
}

// 🕒 Start the main loop
async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// 🔄 Main loop
const mainLoop = async () => {
  if (startPrice === null) {
    startPrice = await getInitialPrice()
    console.log('🔍 Initial price set to', startPrice)
    await executeDCA(true) // Perform an initial purchase
  }

  const shouldContinue = true
  while (shouldContinue) {
    await executeDCA()
    console.log('⏳ Waiting for the next interval...')
    await sleep(60000) // ⏲️ Wait for 1 hour (3600000 milliseconds)
  }
}

mainLoop()
