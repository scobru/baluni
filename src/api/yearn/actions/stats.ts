import YEARN_VAULT_ABI from '../../abis/yearn/YearnVault.json'
import ERC20ABI from '../../abis/common/ERC20.json'
import { BigNumber, ContractInterface, ethers } from 'ethers'
import { INFRA, NETWORKS } from '../../constants'
import routerAbi from '../../abis/infra/Router.json'

export async function accuredYearnInterest(
  pool: string,
  receiver: string,
  chainId: number
) {
  const provider = new ethers.providers.JsonRpcProvider(NETWORKS[chainId])
  const vault = new ethers.Contract(pool, YEARN_VAULT_ABI, provider)
  const balanceVault = await vault.balanceOf(receiver)
  const balanceToken = await vault.previewWithdraw(balanceVault)
  const interest = BigNumber.from(balanceVault.sub(balanceToken))

  console.log(
    '::API::YEARN::STATS 🏦 Balance Vault for ' + pool + ':',
    balanceVault.toString()
  )
  console.log(
    '::API::YEARN::STATS 🪙  Balance Token for ' + pool + ':',
    balanceToken.toString()
  )
  console.log(
    '::API::YEARN::STATS 💶 Accured interest for ' + pool + ':',
    Number(interest)
  )
  console.log('::API::YEARN::STATS Accured interest Calculation DONE!')

  return interest
}

export async function previewWithdraw(
  pool: string,
  receiver: string,
  chainId: number
) {
  const provider = new ethers.providers.JsonRpcProvider(NETWORKS[chainId])
  const vault = new ethers.Contract(pool, YEARN_VAULT_ABI, provider)
  const balanceVault = await vault.balanceOf(receiver)
  const balance = await vault.previewWithdraw(balanceVault)

  return balance
}

export async function getVaultAsset(pool: string, chainId: number) {
  const provider = new ethers.providers.JsonRpcProvider(NETWORKS[chainId])
  const vault = new ethers.Contract(pool, YEARN_VAULT_ABI, provider)
  const asset = await vault.asset()

  return asset
}
