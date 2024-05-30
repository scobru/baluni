import {
  InfraConfig,
  GeneralCOnfig,
  TokenConfig,
  NetworkConfig,
  OracleConfig,
} from './types/constants'

export const BASEURL = 'https://baluni-api.scobrudot.dev'

export const INFRA: InfraConfig = {
  '137': {
    ROUTER: '0x72630A59Aa38dA8b03633a927163908F2EaF826a',
    REBALANCER: '0x4A702645Fc5CcFa1E337f8DAaF3f14d96Fd3595b',
    FACTORY: '0x65fAD42d80d20c6bFD4E5ADf11158958f0bBf5C1',
    POOLFACTORY: '0x8E9f999Bc60bd4dee3A5e8A2f65FEA8e794a3D2E',
    POOLPERIPHERY: '0x9EB57Bd9de4fA485d4360B51a5505b71eD3069cD',
  },
}

export const PROTOCOLS: GeneralCOnfig = {
  '137': {
    'uni-v3': {
      ROUTER: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
      QUOTER: '0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6',
      FACTORY: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
    },
    odos: {
      ROUTER: '0x4E3288c9ca110bCC82bf38F09A7b425c095d92Bf',
    },
  },
}

export const ORACLE: OracleConfig = {
  '137': {
    '1inch-spot-agg': {
      OFFCHAINORACLE: '0x0AdDd25a91563696D8567Df78D5A01C9a991F9B8',
    },
  },
}

export const NATIVETOKENS: TokenConfig = {
  '137': {
    NATIVE: '0x0000000000000000000000000000000000001010',
    WRAPPED: '0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270',
  },
  // Add the rest of yur tokens here
}

export const WETH: NetworkConfig = {
  '137': '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
}

export const USDC: NetworkConfig = {
  '137': '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
}

export const USDT: NetworkConfig = {
  '137': '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
}

export const DAI: NetworkConfig = {
  '137': '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063',
}

export const NETWORKS: NetworkConfig = {
  '137':
    'https://dimensional-floral-lambo.matic.quiknode.pro/a88e447e38026a8fefcd885d500e28229dd116ca/',
}
export const TOKENS_URL = 'https://gateway.ipfs.io/ipns/tokens.uniswap.org'
export const ODOS_QUOTE = 'https://api.odos.xyz/sor/quote/v2'
export const ODOS_ASSEMBLE = 'https://api.odos.xyz/sor/assemble'
