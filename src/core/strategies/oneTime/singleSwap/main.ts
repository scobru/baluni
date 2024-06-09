import { batchSwap } from '../../../common/uniswap/batchSwap'
import { DexWallet, initializeWallet } from '../../../utils/web3/dexWallet'
import { NETWORKS } from '../../../../api'

const main = async () => {
  // CONFIGURE SWAP HERE --------------------------------------------------------------
  // ----------------------------------------------------------------------------------

  const chainId = 137

  const dexWallet = await initializeWallet(NETWORKS[chainId])

  const SWAP = {
    dexWallet: dexWallet as DexWallet,
    token0: 'WBTC',
    token1: 'WETH',
    reverse: false as boolean,
    protocol: 'uni-v3',
    chainId: 137,
    amount: '0.01',
    slippage: 100,
  }

  await batchSwap([
    {
      dexWallet,
      token0: SWAP.token0,
      token1: SWAP.token1,
      reverse: Boolean(SWAP.reverse),
      protocol: SWAP.protocol,
      chainId: SWAP.chainId,
      amount: SWAP.amount,
      slippage: SWAP.slippage,
    },
  ])
}

// END CONFIGURATION -----------------------------------------------------------------

main().then(() => {
  console.log('Async operation completed')
})
