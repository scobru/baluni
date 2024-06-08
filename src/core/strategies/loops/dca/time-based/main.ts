import { initializeWallet } from '../../../../utils/web3/dexWallet'
import { invest } from '../../../oneTime/multiSwapAuto/execute'
import { NETWORKS, USDC } from '../../../../../api'

// 📊 This script performs a time-based Dollar Cost Averaging (DCA) investment
// It invests a specified USD amount into selected tokens at regular intervals
// The investments are distributed based on pre-defined weights.
// USDC to TOKENS

// CONFIGURE INVESTMENT HERE --------------------------------------------------------------
// ----------------------------------------------------------------------------------------

const config = {
  SELECTED_PROTOCOL: 'uni-v3', // ⚙️ Protocol to use for swaps
  SELECTED_CHAINID: 137, // ⚙️ Chain ID (137 for Polygon)
  TOKENS: [
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
  ], // ⚙️ Tokens to invest in
  WEIGHTS_UP: {
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
  }, // ⚙️ Distribution weights for the tokens (in basis points)
  SLIPPAGE: 100, // ⚙️ Slippage tolerance in basis points (1% = 100)
  INVESTMENT_AMOUNT: '1000', // ⚙️ Amount to invest in each interval (in USD)
  INVESTMENT_INTERVAL: 300000, // ⚙️ Interval between investments (in milliseconds)
}

// END CONFIGURATION -----------------------------------------------------------------
//------------------------------------------------------------------------------------

// Main function to perform time-based DCA
async function dcaTimeBased() {
  try {
    // Initialize wallet connection
    const dexWallet = await initializeWallet(
      String(NETWORKS[config.SELECTED_CHAINID!])
    )

    // Function to perform the investment
    const investDCA = async () => {
      try {
        // Execute the investment
        await invest(
          dexWallet,
          config.WEIGHTS_UP,
          String(USDC[config.SELECTED_CHAINID]),
          config?.TOKENS,
          false,
          String(config.INVESTMENT_AMOUNT),
          config.SELECTED_PROTOCOL,
          config?.SELECTED_CHAINID,
          Number(config?.SLIPPAGE)
        )
        console.log('Invested part of funds, continuing DCA')
      } catch (error) {
        console.error('Error during DCA investment:', error)
      }
    }

    // Initial investment
    await investDCA()

    // Schedule further investments at regular intervals
    setInterval(async () => {
      await investDCA()
    }, config?.INVESTMENT_INTERVAL)
  } catch (error) {
    console.error('Error during initialization:', error)
  }
}

// Main function to start the DCA process
async function main() {
  await dcaTimeBased()
  console.log('DCA Rebalancer operation started')
}

// Start the script and handle any errors
main().catch(error => {
  console.error('An error occurred:', error)
})
