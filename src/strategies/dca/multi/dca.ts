import { initializeWallet } from '../../../utils/web3/dexWallet'
import { invest } from '../../investor/execute'
import { NETWORKS, USDC } from 'baluni-api'
import _config from './config.json'

type ConfigType = typeof _config

async function dca() {
  const config: ConfigType = _config

  try {
    const dexWallet = await initializeWallet(
      String(NETWORKS[config.SELECTED_CHAINID!])
    )
    // Initialize your DexWallet here

    // DCA Mechanism - periodically invest
    const investDCA = async () => {
      try {
        await invest(
          dexWallet,
          config.WEIGHTS_UP,
          String(USDC[config.SELECTED_CHAINID]),
          config?.TOKENS,
          false,
          String(config.INVESTMENT_AMOUNT),
          config.SELECTED_PROTOCOL,
          NETWORKS[config?.SELECTED_CHAINID],
          Number(config?.SLIPPAGE)
        )
        console.log('Invested part of funds, continuing DCA')
      } catch (error) {
        console.error('Error during DCA investment:', error)
      }
    }

    // Initial investment
    await investDCA()

    // Schedule further investments
    setInterval(async () => {
      await investDCA()
    }, config?.INVESTMENT_INTERVAL)
  } catch (error) {
    console.error('Error during initialization:', error)
  }
}

async function main() {
  await dca()
  console.log('DCA Rebalancer operation started')
}

main().catch(error => {
  console.error('An error occurred:', error)
})
