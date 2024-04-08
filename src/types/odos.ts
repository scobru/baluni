import { Wallet } from 'ethers'

export type TokenInput = {
  tokenAddress: string
  amount: string // Usually, token amounts are dealt with as strings to avoid precision loss.
}

export type TokenOutput = {
  tokenAddress: string
  proportion: number // Assuming this is a percentage or ratio.
}

export type BuildSwapOdosParams = {
  wallet: Wallet
  sender: string
  chainId: string
  inputTokens: TokenInput[]
  outputTokens: TokenOutput[]
  slippageLimitPercent: number
  referralCode: number
  disableRFQs: boolean
  compact: boolean
}
