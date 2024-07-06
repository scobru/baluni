import { batchSwap } from '../../../common/uniswap/batchSwap'
import { DexWallet, initializeWallet } from '../../../utils/web3/dexWallet'
import { NETWORKS } from '../../../../api'

const main = async () => {
  // CONFIGURE SWAPS HERE --------------------------------------------------------------
  const SELECTED_CHAINID = 137
  const dexWallet: DexWallet = await initializeWallet(
    NETWORKS[SELECTED_CHAINID]
  )

  const SWAPS = [
    {
      dexWallet: dexWallet,
      token0: 'USDC.E',
      token1: 'UNI',
      reverse: false,
      protocol: 'uni-v3',
      chainId: 137,
      amount: '0.0001',
      slippage: 100,
    },
    {
      dexWallet: dexWallet,
      token0: 'WMATIC',
      token1: 'UNI',
      reverse: true,
      protocol: 'uni-v3',
      chainId: 137,
      amount: '0.0001',
      slippage: 100,
    },
  ]
  // END CONFIGURATION -----------------------------------------------------------------

  await batchSwap(SWAPS)
}

main().then(() => {
  console.log('Async operation completed')
})
