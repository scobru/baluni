import {Token} from "@uniswap/sdk-core";

export const parseToken = (rawToken: any, chainId: number): Token => {
    return new Token(chainId,
        rawToken.address,
        Number(rawToken.decimals),
        rawToken.symbol,
        rawToken.name
    );
}