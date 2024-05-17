import { ethers } from 'ethers'
import OffChainOracleAbi from '../../api/abis/1inch/OffChainOracle.json'
import { NETWORKS, ORACLE, NATIVETOKENS, USDC } from '../../api/'

interface Token {
  address: string
  decimals: number
}

export async function fetchPrices(
  token: Token,
  chainId: string
): Promise<number> {
  const provider = new ethers.providers.JsonRpcProvider(NETWORKS[chainId])

  const offChainOracleAddress = ORACLE[chainId]['1inch-spot-agg'].OFFCHAINORACLE

  const offchainOracle = new ethers.Contract(
    offChainOracleAddress,
    OffChainOracleAbi,
    provider
  )

  const rateUSD = await offchainOracle.getRate(
    NATIVETOKENS[chainId].WRAPPED, // destination token
    USDC[chainId], // source token
    true // use source wrappers
  )

  const rateUSDFormatted = rateUSD.mul(1e12)

  const rate = await offchainOracle.getRateToEth(
    token.address, // source token
    true // use source wrappers
  )

  const numerator = 10 ** token.decimals
  const denominator = 1e18 // eth decimals
  const price = (parseFloat(rate) * numerator) / denominator / 1e18
  const priceUSD = (price * rateUSDFormatted) / denominator

  return priceUSD
}
