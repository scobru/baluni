import {
  PROTOCOLS,
  ORACLE,
  NATIVETOKENS,
  NETWORKS,
  TOKENS_URL,
} from '../../api/'

import { YearnVault, TConfig, TConfigReturn } from '../types/config'

export async function formatConfig(config: TConfig) {
  // Dati da inviare all'API
  const payload = {
    tokens: config.TOKENS,
    weightsUp: config.WEIGHTS_UP,
    weightsDown: config.WEIGHTS_DOWN,
    chainId: config.SELECTED_CHAINID,
    yearnEnabled: config.YEARN_ENABLED,
    yearnVaults: config.YEARN_VAULTS,
    limit: config.LIMIT,
    slippage: config.SLIPPAGE,
    interval: config.INTERVAL,
    maxApproval: config.MAX_APPROVAL,
    investmentInterval: config.INVESTMENT_INTERVAL,
    investmentAmount: config.INVESTMENT_AMOUNT,
    trendFollowing: config.TREND_FOLLOWING,
    kstTimeframe: config.KST_TIMEFRAME,
    prediction: config.PREDICTION,
    predictionPeriod: config.PREDICTION_PERIOD,
    predictionEpochs: config.PREDICTION_EPOCHS,
    predictionSymbol: config.PREDICTION_SYMBOL,
    predictionAlgo: config.PREDICTION_ALGO,
    tecnicalAnalysis: config.TECNICAL_ANALYSIS,
    rsiPeriod: config.RSI_PERIOD,
    rsiOverbought: config.RSI_OVERBOUGHT,
    rsiOversold: config.RSI_OVERSOLD,
    rsiTimeframe: config.RSI_TIMEFRAME,
    stockRsiPeriod: config.STOCKRSI_PERIOD,
    stockRsiOverbought: config.STOCKRSI_OVERBOUGHT,
    stockRsiOversold: config.STOCKRSI_OVERSOLD,
    emaTimeframe: config.EMA_TIMEFRAME,
    emaPeriod: config.EMA_PERIOD,
    emaSymbol: config.EMA_SYMBOL,
    emaFast: config.EMA_FAST,
    emaSlow: config.EMA_SLOW,
    vwapPeriod: config.VWAP_PERIOD,
    selectedProtocol: config.SELECTED_PROTOCOL,
  }

  const updatedWeightsDown: Record<string, number> = {}
  const updatedWeightsUp: Record<string, number> = {}
  const updatedYearnVaults: Record<string, string> = {}
  const tokenAddresses = await Promise.all(
    payload.tokens.map((tokenSymbol: string) =>
      fetchTokenAddressByName(tokenSymbol, payload.chainId)
    )
  )

  tokenAddresses.forEach((address, index) => {
    if (address) {
      updatedWeightsUp[address] =
        payload.weightsUp[
          payload.tokens[index] as keyof typeof payload.weightsUp
        ] ?? 0
      updatedWeightsDown[address] =
        payload.weightsDown[
          payload.tokens[index] as keyof typeof payload.weightsDown
        ] ?? 0
    }
  })

  // Se yearnEnabled è true, recupera i dati dei vault di Yearn
  if (payload.yearnEnabled) {
    const yearnVaultsData = await fetchYearnVaultsData(payload.chainId)

    // Itera sui token per cui sono configurati i vault di Yearn
    for (const [tokenSymbol, configYearn] of Object.entries(
      payload.yearnVaults[payload.chainId]
    )) {
      // Ora `config` è del tipo corretto
      const tokenConfig = configYearn as typeof configYearn

      const filteredVaults = yearnVaultsData
        .filter(vault => {
          const matchesSymbol =
            vault.token.symbol.toLowerCase() === tokenSymbol.toLowerCase()
          const isVersion3 =
            vault.version?.startsWith('3.0') ||
            vault.name.includes('3.0') ||
            vault.symbol.includes('3.0')
          let matchesStrategyType = true
          let matchesBoosted = true

          if (tokenConfig.strategy === 'multi') {
            matchesStrategyType = vault.kind === 'Multi Strategy'
          } else if (tokenConfig.strategy === 'single') {
            matchesStrategyType = vault.kind !== 'Multi Strategy'
          }

          // Check if boosted filter is applied
          if (tokenConfig.boosted === true) {
            matchesBoosted = vault.boosted === true
          }

          return (
            matchesSymbol && isVersion3 && matchesStrategyType && matchesBoosted
          )
        })
        .map(vault => vault.address)

      if (filteredVaults.length > 0) {
        updatedYearnVaults[tokenSymbol] = filteredVaults[0]
      }
    }
  }

  return {
    TOKENS: tokenAddresses, // Indirizzi dei token
    WEIGHTS_UP: updatedWeightsUp, // Pesi aggiornati per l'aumento di prezzo
    WEIGHTS_DOWN: updatedWeightsDown, // Pesi aggiornati per il calo di prezzo
    USDC: await fetchTokenAddressByName('USDC.E', payload.chainId),
    NATIVE: NATIVETOKENS[payload.chainId]?.NATIVE,
    WRAPPED: NATIVETOKENS[payload.chainId]?.WRAPPED,
    ORACLE: ORACLE[payload.chainId]?.['1inch-spot-agg']?.OFFCHAINORACLE,
    ROUTER: PROTOCOLS[payload.chainId]?.['uni-v3']?.ROUTER,
    QUOTER: PROTOCOLS[payload.chainId]?.['uni-v3']?.QUOTER,
    FACTORY: PROTOCOLS[payload.chainId]?.['uni-v3']?.FACTORY,
    NETWORKS: NETWORKS[payload.chainId],
    YEARN_ENABLED: payload.yearnEnabled,
    YEARN_VAULTS: updatedYearnVaults,
    LIMIT: payload.limit,
    SLIPPAGE: payload.slippage,
    INTERVAL: payload.interval,
    MAX_APPROVAL: payload.maxApproval,
    INVESTMENT_INTERVAL: payload.investmentInterval,
    INVESTMENT_AMOUNT: payload.investmentAmount,
    TREND_FOLLOWING: payload.trendFollowing,
    KST_TIMEFRAME: payload.kstTimeframe,
    PREDICTION: payload.prediction,
    PREDICTION_PERIOD: payload.predictionPeriod,
    PREDICTION_EPOCHS: payload.predictionEpochs,
    PREDICTION_SYMBOL: payload.predictionSymbol,
    PREDICTION_ALGO: payload.predictionAlgo,
    TECNICAL_ANALYSIS: payload.tecnicalAnalysis,
    RSI_PERIOD: payload.rsiPeriod,
    RSI_OVERBOUGHT: payload.rsiOverbought,
    RSI_OVERSOLD: payload.rsiOversold,
    RSI_TIMEFRAME: payload.rsiTimeframe,
    STOCKRSI_PERIOD: payload.stockRsiPeriod,
    STOCKRSI_OVERBOUGHT: payload.stockRsiOverbought,
    STOCKRSI_OVERSOLD: payload.stockRsiOversold,
    EMA_TIMEFRAME: payload.emaTimeframe,
    EMA_PERIOD: payload.emaPeriod,
    EMA_SYMBOL: payload.emaSymbol,
    EMA_FAST: payload.emaFast,
    EMA_SLOW: payload.emaSlow,
    VWAP_PERIOD: payload.vwapPeriod,
    SELECTED_CHAINID: payload.chainId,
    SELECTED_PROTOCOL: payload.selectedProtocol,
  } as TConfigReturn
}

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

async function fetchTokenAddressByName(
  tokenSymbol: string,
  chainId: number
): Promise<string | null> {
  try {
    const response = await fetch(TOKENS_URL)
    const data = await response.json()

    // Filtra i token per chainId e cerca un token che corrisponda al tokenSymbol fornito
    const matchingToken = data.tokens.find(
      (token: { chainId: number; symbol: string }) =>
        token.chainId === chainId &&
        token.symbol.toLowerCase() === tokenSymbol.toLowerCase()
    )

    // Se il token esiste, restituisci il suo indirizzo
    return matchingToken ? matchingToken.address : null
  } catch (error) {
    console.error('Failed to fetch token address:', error)
    return null
  }
}
