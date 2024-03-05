export type TokenConfig = {
  [chainId: string]: {
    [tokenName: string]: string;
  };
};

type NetworkConfig = {
  [chainId: string]: string;
};

type ProtocolConfig = {
  [chainId: string]: {
    [protocolName: string]: {
      [contractName: string]: string;
    };
  };
};

type OracleConfig = {
  [chainId: string]: {
    [protocolName: string]: {
      [contractName: string]: string;
    };
  };
};

export const PROTOCOLS: ProtocolConfig = {
  "137": {
    "uni-v3": {
      ROUTER: "0xE592427A0AEce92De3Edee1F18E0157C05861564",
      QUOTER: "0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6",
      FACTORY: "0x1F98431c8aD98523631AE4a59f267346ea31F984",
    },
  },
};

export const ORACLE: OracleConfig = {
  "137": {
    "1inch-spot-agg": {
      OFFCHAINORACLE: "0x0AdDd25a91563696D8567Df78D5A01C9a991F9B8",
    },
  },
};

export const NATIVETOKENS: TokenConfig = {
  "137": {
    NATIVE: "0x0000000000000000000000000000000000001010",
    WRAPPED: "0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270",
  },
  // Add the rest of yur tokens here
};

export const NETWORKS: NetworkConfig = {
  "137": "https://polygon-mainnet.g.alchemy.com/v2/u1t0bPCxL7FksVGLrMLW950RqujroHhP",
};

export type ConfigType = { [chainId: string]: { [contractName: string]: string } };
