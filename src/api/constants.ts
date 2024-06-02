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
    ROUTER: '0xEd1B284de8D6B398B5744F5178E8BE198A4DaF5e',
    REBALANCER: '0x9273120cd27226B55b2438CeC06E624163AeeFb1',
    FACTORY: '0xF655f9bEe1c5b7cEA510C5D28C099D56c1Ee88fa',
    POOLFACTORY: '0xcfC1D963E8AbBe9f2c4d8eB0E6d17229b67febF2',
    POOLPERIPHERY: '0xBE099A2a4240b95042c7aAaF8A52a2780f68a2E6',
    REGISTRY: '0xCF4d4CCfE28Ef12d4aCEf2c9F5ebE6BE72Abe182',
    SWAPPER: '0xfd308a0bE8c5a682F61aA0f01Cbb704a7A33AB7c',
    ORACLE: '0x3Ad437171b054FD16c013ec7f62254C052A0DCE7',
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
