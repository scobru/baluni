export type TConfig = {
  SELECTED_PROTOCOL: string
  SELECTED_CHAINID: number
  TOKENS: string[]
  WEIGHTS_UP: { [key: string]: number }
  WEIGHTS_DOWN: { [key: string]: number }
  YEARN_ENABLED: boolean
  YEARN_VAULTS: {
    [key: number]: {
      [token: string]: {
        strategy: string
        boosted: boolean
      }
    }
  }
  LIMIT: number
  SLIPPAGE: number
  INTERVAL: number
  MAX_APPROVAL: boolean
  INVESTMENT_INTERVAL: number
  INVESTMENT_AMOUNT: number
  TREND_FOLLOWING: boolean
  KST_TIMEFRAME: string
  PREDICTION: boolean
  PREDICTION_PERIOD: number
  PREDICTION_EPOCHS: number
  PREDICTION_SYMBOL: string
  PREDICTION_ALGO: string
  TECNICAL_ANALYSIS: boolean
  RSI_PERIOD: number
  RSI_OVERBOUGHT: number
  RSI_OVERSOLD: number
  RSI_TIMEFRAME: string
  STOCKRSI_PERIOD: number
  STOCKRSI_OVERBOUGHT: number
  STOCKRSI_OVERSOLD: number
  EMA_PERIOD?: number
  EMA_SYMBOL?: string
  EMA_FAST?: number
  EMA_SLOW?: number
  EMA_TIMEFRAME?: string
  VWAP_PERIOD?: number
}

export interface Token {
  address: string
  name: string
  symbol: string
  chainId: number
}

export interface Strategy {
  // Define properties if known
}

export interface Migration {
  available: boolean
  address: string
  contract: string
}

export interface Staking {
  available: boolean
  address: string
  tvl: number
  risk: number
}

export interface YearnVault {
  address: string
  name: string
  symbol: string
  token: Token
  strategy?: Strategy[]
  migration?: Migration
  staking?: Staking
  kind: string
  version?: string
  boosted: boolean
}

export interface TConfigReturn {
  TOKENS: string[] // Array of token addresses
  WEIGHTS_UP: Record<string, number> // Updated weights for price increase
  WEIGHTS_DOWN: Record<string, number> // Updated weights for price decrease
  USDC: string // Address of USDC.E token
  NATIVE: string // Address of native token, if applicable
  WRAPPED: string // Address of wrapped token, if applicable
  ORACLE: string // Address or identifier of the oracle used
  ROUTER: string // Address of the protocol's router
  QUOTER: string // Address of the protocol's quoter
  FACTORY: string // Address of the protocol's factory
  NETWORKS: string // Identifier for the network
  YEARN_ENABLED: boolean // Whether Yearn integration is enabled
  YEARN_VAULTS: Record<string, string> // Addresses of Yearn vaults, keyed by token symbol
  LIMIT: number // Limit configuration
  SLIPPAGE: number // Slippage configuration
  INTERVAL: number // Interval configuration
  MAX_APPROVAL: boolean // Max approval configuration
  INVESTMENT_INTERVAL: number // Investment interval configuration
  INVESTMENT_AMOUNT: number // Investment amount configuration
  TREND_FOLLOWING: boolean // Whether trend following is enabled
  KST_TIMEFRAME: string // Timeframe for KST
  PREDICTION: boolean // Whether prediction is enabled
  PREDICTION_PERIOD: number // Prediction period configuration
  PREDICTION_EPOCHS: number // Number of epochs for prediction
  PREDICTION_SYMBOL: string // Symbol used for prediction
  PREDICTION_ALGO: string // Algorithm used for prediction
  TECNICAL_ANALYSIS: boolean // Whether technical analysis is enabled
  RSI_PERIOD: number // Period for RSI calculation
  RSI_OVERBOUGHT: number // Overbought threshold for RSI
  RSI_OVERSOLD: number // Oversold threshold for RSI
  RSI_TIMEFRAME: string // Timeframe for RSI calculation
  STOCKRSI_PERIOD: number // Period for Stochastic RSI calculation
  STOCKRSI_OVERBOUGHT: number // Overbought threshold for Stochastic RSI
  STOCKRSI_OVERSOLD: number // Oversold threshold for Stochastic RSI
  EMA_TIMEFRAME?: string // Timeframe for EMA calculation
  EMA_PERIOD?: number // Period for EMA calculation
  EMA_SYMBOL?: string // Symbol used for EMA calculation
  EMA_FAST?: number // Fast period for EMA calculation
  EMA_SLOW?: number // Slow period for EMA calculation
  VWAP_PERIOD?: number // Period for VWAP calculation
  SELECTED_CHAINID: number // Selected chain ID
  SELECTED_PROTOCOL: string // Selected protocol
}
