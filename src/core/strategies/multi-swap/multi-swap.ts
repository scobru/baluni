import { batchSwap } from '../../common/uniswap/batchSwap'
import { DexWallet, initializeWallet } from '../../utils/web3/dexWallet'
import { NETWORKS } from '../../../api/'

const main = async () => {
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
      amount: '0.0001', // Change the type of amount from number to string
      slippage: 100,
    },
    {
      dexWallet: dexWallet,
      token0: 'WMATIC',
      token1: 'UNI',
      reverse: true,
      protocol: 'uni-v3',
      chainId: 137,
      amount: '0.0001', // Change the type of amount from number to string
      slippage: 100,
    },
  ]

  await batchSwap(SWAPS)
}

main().then(() => {
  console.log('Async operation completed')
})
