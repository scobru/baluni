import { initializeWallet } from '../../utils/web3/dexWallet' // Import the initializeWallet function
import { invest } from './execute'
import { USDC, NETWORKS } from 'baluni-api'
import _config from './config.json'

type ConfigType = typeof _config

const amount = String(process.argv[3])
const sellAll = Boolean(process.argv[4])
const config: ConfigType = _config

async function investor() {
  try {
    const dexWallet = await initializeWallet(
      String(NETWORKS[config?.SELECTED_CHAINID])
    )

    await invest(
      dexWallet,
      config?.WEIGHTS_UP,
      String(USDC[config?.SELECTED_CHAINID]),
      config?.TOKENS,
      sellAll,
      amount,
      config?.SELECTED_PROTOCOL,
      config?.SELECTED_CHAINID,
      Number(config?.SLIPPAGE)
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
