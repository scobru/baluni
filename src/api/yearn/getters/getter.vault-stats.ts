import { ethers } from 'ethers'
import YEARN_VAULT_ABI from '../../abis/yearn/YearnVault.json'
import { NETWORKS } from '../../constants'

export class VaultStats {
  static id = 'vault-stats'
  static protocolId = 'yearn'

  get id() {
    return VaultStats.id
  }

  get protocolId() {
    return VaultStats.protocolId
  }

  async accuredInterest(pool: string, receiver: string, chainId: number) {
    const provider = new ethers.providers.JsonRpcProvider(NETWORKS[chainId])
    const vault = new ethers.Contract(pool, YEARN_VAULT_ABI, provider)
    const balanceVault = await vault.balanceOf(receiver)
    const balanceToken = await vault.previewWithdraw(balanceVault)
    const interest = BigInt(balanceVault.sub(balanceToken))

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

  async previewWithdraw(pool: string, receiver: string, chainId: number) {
    const provider = new ethers.providers.JsonRpcProvider(NETWORKS[chainId])
    const vault = new ethers.Contract(pool, YEARN_VAULT_ABI, provider)
    const balanceVault = await vault.balanceOf(receiver)
    const balance = await vault.previewWithdraw(balanceVault)

    return balance
  }

  async getAsset(pool: string, chainId: number) {
    const provider = new ethers.providers.JsonRpcProvider(NETWORKS[chainId])
    const vault = new ethers.Contract(pool, YEARN_VAULT_ABI, provider)
    const asset = await vault.asset()

    return asset
  }
}
