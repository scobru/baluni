export type InfraConfig = {
  [chainId: string]: {
    ROUTER: string
    REBALANCER: string
    FACTORY: string
  }
}

export type NetworkConfig = {
  [chainId: string]: string
}

export interface ProtocolConfig {
  ROUTER: string
  QUOTER: string
  FACTORY: string
}

export interface ChainConfig {
  'uni-v3'?: {
    ROUTER: string
    QUOTER?: string
    FACTORY?: string
  }
  odos?: {
    ROUTER?: string
  }
}

export interface TokenConfig {
  [chainId: string]: {
    WRAPPED: string
    NATIVE: string
  }
}

export interface OracleConfig {
  [chainId: string]: {
    [oracleName: string]: {
      OFFCHAINORACLE: string
    }
  }
}

export interface GeneralCOnfig {
  [key: string]: ChainConfig
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

export interface Configurations {
  [key: string]: any // Use a more specific type if possible for your configurations
}
