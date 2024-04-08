import { BigNumber, ethers } from 'ethers'

export type TDeposit = {
  wallet: ethers.Wallet
  tokenAddr: string
  pool: string
  amount: BigNumber
  receiver: string
  chainId: string
}

export type TRedeem = {
  wallet: ethers.Wallet
  pool: string
  amount: BigNumber
  receiver: string
  chainId: string
}
