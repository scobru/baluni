import { initializeWallet } from '../../../utils/web3/dexWallet' // Import the initializeWallet function
import { invest } from './execute'
import { USDC, NETWORKS } from '../../../../api'

// CONFIGURE INVESTMENT HERE --------------------------------------------------------------
const chainId = 137
const slippage = 100
const protocol = 'uni-v3'
const usdc = USDC[chainId]
const sellAll = true
const amountToInvest = '1000' // Amount to invest in USDC
const TOKENS = [
  'LINK',
  'WETH',
  'WBTC',
  'UNI',
  'AAVE',
  'WMATIC',
  'CRV',
  'SNX',
  'GRT',
  'USDC.E',
]
const WEIGHTS = {
  LINK: 500,
  WETH: 1000,
  WBTC: 3750,
  UNI: 1000,
  AAVE: 1000,
  WMATIC: 1000,
  CRV: 500,
  SNX: 500,
  GRT: 500,
  'USDC.E': 250,
}
// END CONFIGURATION -----------------------------------------------------------------

async function investor() {
  try {
    const dexWallet = await initializeWallet(String(NETWORKS[chainId]))
    await invest(
      dexWallet,
      WEIGHTS,
      usdc,
      TOKENS,
      sellAll,
      amountToInvest,
      protocol,
      chainId,
      slippage
    )
    console.log('Investing operation completed')
  } catch (error) {
    console.error('Error during initialization:', error)
  }
}

async function main() {
  await investor()
  console.log('Rebalancer operation started')
}

main().catch(error => {
  console.error('An error occurred:', error)
})
