// server.ts
import express from 'express'
import {
  PROTOCOLS,
  ORACLE,
  NATIVETOKENS,
  NETWORKS,
  TOKENS_URL,
} from './constants'
import { buildSwapUniswap } from './uniswap'
import { ethers } from 'ethers'
import { depositToYearn, redeemFromYearn } from './yearn/vault'
import { fetchTokenAddressByName } from './utils/uniswap/fetchToken'
import cors from 'cors'
import { buildSwapOdos } from './odos'
import bodyParser from 'body-parser'
import { YearnVault, Configurations } from './types/constants'
import {
  AlphaRouter,
  CurrencyAmount,
  SwapType,
} from '@uniswap/smart-order-router'
import { TradeType } from '@uniswap/sdk'
import { Percent } from '@uniswap/sdk-core'
import { parseToken } from './utils/uniswap/parseToken'

const app = express()
const port = 3001

const CONFIGURATIONS: Configurations = {
  protocols: PROTOCOLS,
  oracle: ORACLE,
  nativeTokens: NATIVETOKENS,
  networks: NETWORKS,
}

app.use(cors())

app.use(bodyParser.json())

app.get('/', (req, res) => {
  res.send('Hello World!')
})

app.get('/:chainId/uni-v3/tokens', async (req, res) => {
  try {
    const response = await fetch(TOKENS_URL)
    const data = await response.json()
    const { chainId } = req.params
    const filteredTokens = data.tokens.filter(
      (token: { chainId: number }) => token.chainId === Number(chainId)
    )

    res.json(filteredTokens)
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch tokens', error: error })
  }
})

app.get('/:chainId/uni-v3/tokens/:tokenSymbol', async (req, res) => {
  const { chainId, tokenSymbol } = req.params

  if (!chainId || !tokenSymbol) {
    return res
      .status(400)
      .json({ error: 'Missing chainId or tokenName query parameter' })
  }

  try {
    const response = await fetch(TOKENS_URL)
    const data = await response.json()
    const matchingTokens = data.tokens.filter(
      (token: { chainId: number; symbol: string }) =>
        token.chainId === Number(chainId) &&
        token.symbol.toLowerCase() === tokenSymbol.toString().toLowerCase()
    )

    if (matchingTokens.length === 0) {
      return res.status(404).json({ error: 'Token not found' })
    }

    res.json(matchingTokens[0]) // Returns the first matching token, assuming names are unique per chainId
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch tokens', error: error })
  }
})

app.get('/:chainId/yearn-v3/vaults/:tokenSymbol', async (req, res) => {
  const { tokenSymbol, chainId } = req.params
  const { strategyType, boosted } = req.query
  const apiURL = `https://ydaemon.yearn.fi/${chainId}/vaults/all`

  try {
    const response = await fetch(apiURL)
    const data: YearnVault[] = await response.json()

    const filteredVaults = data.filter(vault => {
      const matchesSymbol =
        vault.token.symbol.toLowerCase() === tokenSymbol.toLowerCase()
      const isVersion3 =
        vault.version?.startsWith('3.0') ||
        vault.name.includes('3.0') ||
        vault.symbol.includes('3.0')
      let matchesStrategyType = true
      let matchesBoosted = true

      if (strategyType === 'multi') {
        matchesStrategyType = vault.kind === 'Multi Strategy'
      } else if (strategyType === 'single') {
        matchesStrategyType = vault.kind !== 'Multi Strategy'
      }

      // Check if boosted filter is applied
      if (boosted === 'true') {
        matchesBoosted = vault.boosted === true
      }

      return (
        matchesSymbol && isVersion3 && matchesStrategyType && matchesBoosted
      )
    })

    if (filteredVaults.length === 0) {
      return res
        .status(404)
        .json({ error: 'Vault not found for the given criteria' })
    }

    const vault = filteredVaults[0]
    res.json({
      vaultAddress: vault.address,
      vaultName: vault.name,
      vaultSymbol: vault.symbol,
      tokenAddress: vault.token.address,
      tokenName: vault.token.name,
      tokenSymbol: vault.token.symbol,
      strategyType: vault.kind,
      version: vault.version,
      boosted: vault.boosted, // Include boosted status in the response
    })
  } catch (error) {
    console.error('Failed to fetch Yearn Finance vaults:', error)
    res.status(500).json({ error: 'Failed to fetch Yearn Finance vaults' })
  }
})

app.get('/:chainId/yearn-v3/vaults', async (req, res) => {
  const { chainId } = req.params
  const apiURL = `https://ydaemon.yearn.fi/${chainId}/vaults/all`

  try {
    const response = await fetch(apiURL)
    return await response.json()
  } catch (error) {
    console.error('Failed to fetch Yearn Finance vaults:', error)
    res.status(500).json({ error: 'Failed to fetch Yearn Finance vaults.' })
  }
})

app.get('/config/:chainId/:protocolName/:contractName', (req, res) => {
  const { chainId, contractName, protocolName } = req.params
  const config =
    CONFIGURATIONS['protocols']?.[chainId]?.[protocolName]?.[
      contractName.toUpperCase()
    ]

  if (!config) {
    return res
      .status(404)
      .json({ error: 'Configuration not found for the given parameters' })
  }

  res.json({ chainId, contractName, address: config })
})

app.get(
  '/:chainId/uni-v3/swap/:address/:token0/:token1/:reverse/:amount/:slippage',
  async (req, res) => {
    const { address, token0, token1, reverse, chainId, amount, slippage } =
      req.params

    try {
      const tokenAAddress = await fetchTokenAddressByName(
        token0,
        Number(chainId)
      )

      const tokenBAddress = await fetchTokenAddressByName(
        token1,
        Number(chainId)
      )

      const wallet = new ethers.Wallet(
        process.env.PRIVATE_KEY,
        new ethers.providers.JsonRpcProvider(NETWORKS[chainId])
      )

      const swapResult = await buildSwapUniswap([
        {
          wallet,
          address,
          token0: tokenAAddress!,
          token1: tokenBAddress!,
          reverse: Boolean(reverse),
          protocol: 'uni-v3',
          chainId,
          amount,
          slippage: Number(slippage),
        },
      ])

      console.log('Swap result:', swapResult)

      res.json({
        Approvals: swapResult.Approvals,
        ApprovalsAgent: swapResult.ApprovalsAgent,
        Calldatas: swapResult.Calldatas,
        TokensReturn: swapResult.TokensReturn,
      })
    } catch (error) {
      console.error('Error during swap operation:', error)
      res.status(500).json({ error: 'Error during swap operation' })
    }
  }
)

app.get(
  '/:chainId/yearn-v3/deposit/:tokenSymbol/:strategy/:boosted/:amount/:receiver/',
  async (req, res) => {
    try {
      const { tokenSymbol, strategy, amount, receiver, chainId, boosted } =
        req.params

      // Ora `config` è del tipo corretto
      const filteredVaults = await fetchYearnVaultsData(Number(chainId))

      filteredVaults
        .filter(vault => {
          const matchesSymbol =
            vault.token.symbol.toLowerCase() === tokenSymbol.toLowerCase()
          const isVersion3 =
            vault.version?.startsWith('3.0') ||
            vault.name.includes('3.0') ||
            vault.symbol.includes('3.0')
          let matchesStrategyType = true
          let matchesBoosted = true

          if (strategy === 'multi') {
            matchesStrategyType = vault.kind === 'Multi Strategy'
          } else if (strategy === 'single') {
            matchesStrategyType = vault.kind !== 'Multi Strategy'
          }

          if (boosted === 'true') {
            matchesBoosted = vault.boosted === true
          }

          return (
            matchesSymbol && isVersion3 && matchesStrategyType && matchesBoosted
          )
        })
        .map(vault => vault.address)

      const vaultAddress = filteredVaults[0]
      const tokenAddress = await fetchTokenAddressByName(
        tokenSymbol,
        Number(chainId)
      )

      const walletInstance = new ethers.Wallet(
        process.env.PRIVATE_KEY,
        new ethers.providers.JsonRpcProvider(NETWORKS[chainId])
      )

      let adjAmount: ethers.BigNumber

      if (
        tokenSymbol === 'USDC' ||
        tokenSymbol === 'USDT' ||
        tokenSymbol === 'USDC.E'
      ) {
        adjAmount = ethers.utils.parseUnits(amount, 6)
      } else if (tokenSymbol === 'WBTC') {
        adjAmount = ethers.utils.parseUnits(amount, 8)
      } else {
        adjAmount = ethers.utils.parseUnits(amount, 18)
      }

      const result = await depositToYearn(
        walletInstance,
        tokenAddress,
        vaultAddress.address,
        adjAmount,
        receiver,
        chainId
      )

      res.json(result)
    } catch (error) {
      console.error(error)
      res.status(500).json({ error: error.toString() })
    }
  }
)

app.get(
  ':chainId/yearn-v3/redeem/:tokenSymbol/:strategy/:boosted/:amount/:receiver/',
  async (req, res) => {
    try {
      const { tokenSymbol, strategy, amount, receiver, chainId, boosted } =
        req.params

      let adjAmount: ethers.BigNumber

      if (
        tokenSymbol === 'USDC' ||
        tokenSymbol === 'USDT' ||
        tokenSymbol === 'USDC.E'
      ) {
        adjAmount = ethers.utils.parseUnits(amount, 6)
      } else if (tokenSymbol === 'WBTC') {
        adjAmount = ethers.utils.parseUnits(amount, 8)
      } else {
        adjAmount = ethers.utils.parseUnits(amount, 18)
      }

      const filteredVaults = await fetchYearnVaultsData(Number(chainId))

      filteredVaults
        .filter(vault => {
          const matchesSymbol =
            vault.token.symbol.toLowerCase() === tokenSymbol.toLowerCase()
          const isVersion3 =
            vault.version?.startsWith('3.0') ||
            vault.name.includes('3.0') ||
            vault.symbol.includes('3.0')
          let matchesStrategyType = true
          let matchesBoosted = true

          if (strategy === 'multi') {
            matchesStrategyType = vault.kind === 'Multi Strategy'
          } else if (strategy === 'single') {
            matchesStrategyType = vault.kind !== 'Multi Strategy'
          }

          if (boosted === 'true') {
            matchesBoosted = vault.boosted === true
          }

          return (
            matchesSymbol && isVersion3 && matchesStrategyType && matchesBoosted
          )
        })
        .map(vault => vault.address)

      const vaultAddress = filteredVaults[0]

      const walletInstance = new ethers.Wallet(
        process.env.PRIVATE_KEY,
        new ethers.providers.JsonRpcProvider(NETWORKS[chainId])
      )

      const result = await redeemFromYearn(
        walletInstance,
        vaultAddress.address,
        adjAmount,
        receiver,
        chainId
      )

      res.json(result)
    } catch (error) {
      console.error(error)
      res.status(500).json({ error: error.toString() })
    }
  }
)

app.post('/:chainId/odos/swap', async (req, res) => {
  const { address, inputTokens, outputTokens, slippage } = req.body

  const { chainId } = req.params
  try {
    const inputTokensArray = inputTokens.map(
      (token: { tokenAddress: any; amount: any }) => ({
        tokenAddress: token.tokenAddress,
        amount: token.amount,
      })
    )
    const outputTokensArray = outputTokens.map(
      (token: { tokenAddress: any; proportion: any }) => ({
        tokenAddress: token.tokenAddress,
        proportion: token.proportion,
      })
    )

    const wallet = new ethers.Wallet(
      process.env.PRIVATE_KEY,
      new ethers.providers.JsonRpcProvider(NETWORKS[chainId])
    )

    const swapResult = await buildSwapOdos(
      wallet,
      address,
      chainId,
      inputTokensArray,
      outputTokensArray,
      Number(slippage),
      3844415834, // referralCode
      false, // disableRFQs
      true // compact
    )

    console.log('Swap result:', swapResult)

    res.json({
      Approvals: swapResult.Approvals,
      Calldatas: swapResult.Calldatas,
      TokensReturn: swapResult.TokensReturn,
    })
  } catch (error) {
    console.error('Error during swap operation:', error)
    res.status(500).json({ error: 'Error during swap operation' })
  }
})

app.post('/route', (req, res) => {
  const reqBody = req.body

  const router = new AlphaRouter({
    chainId: reqBody.chainId,
    provider: new ethers.providers.JsonRpcProvider(NETWORKS[reqBody.chainId]),
  })

  const currencyAmount = parseToken(reqBody.currencyAmount, reqBody.chainId)
  const currency = parseToken(reqBody.currency, reqBody.chainId)
  const tradeType = (reqBody.tradeType as TradeType) || TradeType.EXACT_INPUT
  const SLIPPAGE = new Percent(50, 10_000) // Correct 15%

  router
    .route(
      CurrencyAmount.fromRawAmount(currencyAmount, reqBody.amount),
      currency,
      tradeType,
      {
        slippageTolerance: SLIPPAGE,
        type: SwapType.UNIVERSAL_ROUTER,
        recipient: ethers.constants.AddressZero,
        deadlineOrPreviousBlockhash: Math.floor(Date.now() / 1000) + 360,
      },
      {
        minSplits: 3,
      }
    )
    .then(route => {
      if (!route) {
        res.status(404)
        res.send('No route found')
        return
      }
      res.json(route)
    })
    .catch(err => {
      res.status(500)
      res.send('Internal server error')
      console.log(err)
    })
})

// HELPER FUNCTIONS
async function fetchYearnVaultsData(chainId: number): Promise<YearnVault[]> {
  try {
    const apiURL = `https://ydaemon.yearn.fi/${chainId}/vaults/all`
    const response = await fetch(apiURL)
    const data: YearnVault[] = await response.json()
    return data
  } catch (error) {
    console.error('Failed to fetch Yearn Finance vaults:', error)
    return []
  }
}

app.listen(port, () => {
  console.log(`Server running on port ${port}`)
})
