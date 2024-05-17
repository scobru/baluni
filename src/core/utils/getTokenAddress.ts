import { BASEURL } from '../../api/'

// Get Token Address from api through Uniswap api
export async function getTokenAddressUniV3(symbol: string, chainId: any) {
  const token0AddressUrl = `${BASEURL}/${chainId}/uni-v3/tokens/${symbol}`
  let response = await fetch(token0AddressUrl, {
    method: 'GET',
  })

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`)
  }
  const token0Info = await response.json().then(data => data)

  return token0Info.address
}
