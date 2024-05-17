import { ethers } from 'ethers'
import uniswapV3FactoryAbi from '../../abis/uniswap/Factory.json'
import uniswapV3PoolAbi from '../../abis/uniswap/Pool.json'
import erc20Abi from '../../abis/common/ERC20.json' // Assuming you have ERC20 ABI for fetching decimals
import { PROTOCOLS, NETWORKS } from '../../constants'

export async function quotePair(
  tokenAAddress: string,
  tokenBAddress: string,
  chainId: number
) {
  const uniswapV3FactoryAddress = PROTOCOLS[chainId]['uni-v3'].FACTORY
  // Connect to the BSC mainnet
  // const provider = ethers.getDefaultProvider();
  const provider = new ethers.providers.JsonRpcProvider(NETWORKS[chainId])

  // Get the contract instance
  const factoryContract = new ethers.Contract(
    uniswapV3FactoryAddress,
    uniswapV3FactoryAbi,
    provider
  )

  const tokenAContract = new ethers.Contract(tokenAAddress, erc20Abi, provider)
  const tokenBContract = new ethers.Contract(tokenBAddress, erc20Abi, provider)

  // Fetch decimals for both tokens
  const tokenADecimals = await tokenAContract.decimals()
  const tokenBDecimals = await tokenBContract.decimals()

  const txInputs = [tokenAAddress, tokenBAddress, 3000]

  try {
    const poolAddress = await factoryContract.getPool(...txInputs)

    const poolContract = new ethers.Contract(
      poolAddress,
      uniswapV3PoolAbi,
      provider
    )
    const slot0 = await poolContract.slot0()

    const { tick } = slot0
    const tokenBPrice = 1 / (1.0001 ** tick * 10 ** -12)

    if (tokenADecimals == 8) {
      return (tokenBPrice / 1e5) * 2
    } else {
      return tokenBPrice
    }
  } catch {
    return false
  }
}
