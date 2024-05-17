import { TOKENS_URL } from '../../constants'

export async function fetchTokenAddressByName(
  tokenSymbol: string,
  chainId: number
): Promise<string | null> {
  try {
    const response = await fetch(TOKENS_URL)
    const data = await response.json()

    // Filtra i token per chainId e cerca un token che corrisponda al tokenSymbol fornito
    const matchingToken = data.tokens.find(
      (token: { chainId: number; symbol: string }) =>
        token.chainId === chainId &&
        token.symbol.toLowerCase() === tokenSymbol.toLowerCase()
    )

    // Se il token esiste, restituisci il suo indirizzo
    return matchingToken ? matchingToken.address : null
  } catch (error) {
    console.error('Failed to fetch token address:', error)
    return null
  }
}

export async function fetchTokenAddresses(
  chainId: number
): Promise<string[] | null> {
  try {
    const response = await fetch(TOKENS_URL)
    const data = await response.json()

    // Filtra i token per chainId e cerca i token che corrispondono al tokenSymbol fornito
    const matchingTokens = data.tokens.filter(
      (token: { chainId: number }) => token.chainId === chainId
    )

    // Se esistono token corrispondenti, restituisci un array dei loro indirizzi
    return matchingTokens.length > 0
      ? matchingTokens.map(token => token.address)
      : null
  } catch (error) {
    console.error('Failed to fetch token addresses:', error)
    return null
  }
}
