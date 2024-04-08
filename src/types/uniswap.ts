import { DexWallet } from '../utils/web3/dexWallet'

export type Tswap = {
  dexWallet: DexWallet
  token0: string
  token1: string
  reverse: boolean
  protocol: string
  chainId: number
  amount: string
  slippage: number
}
