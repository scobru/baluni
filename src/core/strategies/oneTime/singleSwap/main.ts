import { swap } from '../../../common/uniswap/swap'
import { initializeWallet } from '../../../utils/web3/dexWallet'
import { NETWORKS } from '../../../../api'

const main = async () => {
  // CONFIGURE SWAP HERE --------------------------------------------------------------
  // ----------------------------------------------------------------------------------

  const chainId = 137

  const dexWallet = await initializeWallet(NETWORKS[chainId])

  const SWAP = {
    dexWallet: dexWallet,
    token0: 'WBTC',
    token1: 'WETH',
    action: 'pump',
    protocol: 'uni-v3',
    chainId: 137,
    amount: '0.01',
    slippage: 100,
  }

  await swap(
    SWAP.dexWallet,
    SWAP.token0,
    SWAP.token1,
    SWAP.action == 'pump' ? false : true,
    SWAP.protocol,
    SWAP.chainId,
    SWAP.amount,
    SWAP.slippage
  )
}

// END CONFIGURATION -----------------------------------------------------------------

main().then(() => {
  console.log('Async operation completed')
})
