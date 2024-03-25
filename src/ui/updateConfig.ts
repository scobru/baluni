import * as Config from "./config";
import { PROTOCOLS, ORACLE, NATIVETOKENS, NETWORKS, TOKENS_URL } from "baluni-api";

interface YearnVault {
  address: string;
  name: string;
  symbol: string;
  token: {
    address: string;
    name: string;
    symbol: string;
  };
  strategies?: any[];
  migration?: {
    available: boolean;
    address: string;
    contract: string;
  };
  staking?: {
    available: boolean;
    address: string;
    tvl: number;
    risk: number;
  };
  kind: string;
  version?: string;
  boosted: boolean;
}

export async function updateConfig(
  tokens: string[],
  allocations: { [token: string]: number },
  chainId: number,
  yearnEnabled: boolean,
  yearnVaults: Record<string, any>,
  limit: number,
  trendFollowing: boolean,
  technicalAnalysis: boolean,
) {
  // Dati da inviare all'API
  const payload = {
    tokens: tokens,
    weightsUp: allocations,
    weightsDown: allocations,
    chainId: chainId,
    yearnEnabled: yearnEnabled,
    yearnVaults: yearnVaults,
    limit: limit,
    slippage: Config.SLIPPAGE,
    interval: Config.INTERVAL,
    maxApproval: Config.MAX_APPROVAL,
    investmentInterval: Config.INVESTMENT_INTERVAL,
    investmentAmount: Config.INVESTMENT_AMOUNT,
    trendFollowing: trendFollowing,
    kstTimeframe: Config.KST_TIMEFRAME,
    prediction: Config.PREDICTION,
    predictionPeriod: Config.PREDICTION_PERIOD,
    predictionEpochs: Config.PREDICTION_EPOCHS,
    predictionSymbol: Config.PREDICTION_SYMBOL,
    predictionAlgo: Config.PREDICTION_ALGO,
    tecnicalAnalysis: technicalAnalysis,
    rsiPeriod: Config.RSI_PERIOD,
    rsiOverbought: Config.RSI_OVERBOUGHT,
    rsiOversold: Config.RSI_OVERSOLD,
    rsiTimeframe: Config.RSI_TIMEFRAME,
    stockRsiPeriod: Config.STOCKRSI_PERIOD,
    stockRsiOverbought: Config.STOCKRSI_OVERBOUGHT,
    stockRsiOversold: Config.STOCKRSI_OVERSOLD,
    selectedProtocol: Config.SELECTED_PROTOCOL,
  };

  const updatedWeightsDown: Record<string, number> = {};
  const updatedWeightsUp: Record<string, number> = {};
  const updatedYearnVaults: Record<string, string> = {};

  const tokenAddresses = await Promise.all(
    payload.tokens.map((tokenSymbol: string) => fetchTokenAddressByName(tokenSymbol, payload.chainId)),
  );

  tokenAddresses.forEach((address, index) => {
    if (address) {
      updatedWeightsUp[address] = payload.weightsUp[payload.tokens[index] as keyof typeof payload.weightsUp] ?? 0;
      updatedWeightsDown[address] = payload.weightsDown[payload.tokens[index] as keyof typeof payload.weightsDown] ?? 0;
    }
  });

  // Se yearnEnabled è true, recupera i dati dei vault di Yearn
  if (payload.yearnEnabled) {
    const yearnVaultsData = await fetchYearnVaultsData(payload.chainId);

    // Itera sui token per cui sono configurati i vault di Yearn
    for (const [tokenSymbol, _config] of Object.entries(payload.yearnVaults[payload.chainId])) {
      // Ora `config` è del tipo corretto
      const tokenConfig: any = _config;

      const filteredVaults = yearnVaultsData
        .filter(vault => {
          const matchesSymbol = vault.token.symbol.toLowerCase() === tokenSymbol.toLowerCase();
          const isVersion3 =
            vault.version?.startsWith("3.0") || vault.name.includes("3.0") || vault.symbol.includes("3.0");
          let matchesStrategyType = true;
          let matchesBoosted = true;

          if (tokenConfig.strategy === "multi") {
            matchesStrategyType = vault.kind === "Multi Strategy";
          } else if (tokenConfig.strategy === "single") {
            matchesStrategyType = vault.kind !== "Multi Strategy";
          }

          // Check if boosted filter is applied
          if (tokenConfig.boosted === "true") {
            matchesBoosted = vault.boosted === true;
          }

          return matchesSymbol && isVersion3 && matchesStrategyType && matchesBoosted;
        })
        .map(vault => vault.address);

      if (filteredVaults.length > 0) {
        updatedYearnVaults[tokenSymbol] = filteredVaults[0];
      }
    }
  }

  return {
    TOKENS: tokenAddresses, // Indirizzi dei token
    WEIGHTS_UP: updatedWeightsUp, // Pesi aggiornati per l'aumento di prezzo
    WEIGHTS_DOWN: updatedWeightsDown, // Pesi aggiornati per il calo di prezzo
    USDC: await fetchTokenAddressByName("USDC.E", payload.chainId),
    NATIVE: NATIVETOKENS[payload.chainId]?.NATIVE,
    WRAPPED: NATIVETOKENS[payload.chainId]?.WRAPPED,
    ORACLE: ORACLE[payload.chainId]?.["1inch-spot-agg"]?.OFFCHAINORACLE,
    ROUTER: PROTOCOLS[payload.chainId]?.["uni-v3"]?.ROUTER,
    QUOTER: PROTOCOLS[payload.chainId]?.["uni-v3"]?.QUOTER,
    FACTORY: PROTOCOLS[payload.chainId]?.["uni-v3"]?.FACTORY,
    NETWORKS: NETWORKS[payload.chainId],
    YEARN_ENABLED: payload.yearnEnabled,
    YEARN_VAULTS: updatedYearnVaults,
    LIMIT: payload.limit,
    SLIPPAGE: payload.slippage,
    INTERVAL: payload.interval,
    MAX_APPROVAL: payload.maxApproval,
    INVESTMENT_INTERVAL: payload.investmentInterval,
    INVESTMENT_AMOUNT: payload.investmentAmount,
    TREND_FOLLOWING: payload.trendFollowing,
    KST_TIMEFRAME: payload.kstTimeframe,
    PREDICTION: payload.prediction,
    PREDICTION_PERIOD: payload.predictionPeriod,
    PREDICTION_EPOCHS: payload.predictionEpochs,
    PREDICTION_SYMBOL: payload.predictionSymbol,
    PREDICTION_ALGO: payload.predictionAlgo,
    TECNICAL_ANALYSIS: payload.tecnicalAnalysis,
    RSI_PERIOD: payload.rsiPeriod,
    RSI_OVERBOUGHT: payload.rsiOverbought,
    RSI_OVERSOLD: payload.rsiOversold,
    RSI_TIMEFRAME: payload.rsiTimeframe,
    STOCKRSI_PERIOD: payload.stockRsiPeriod,
    STOCKRSI_OVERBOUGHT: payload.stockRsiOverbought,
    STOCKRSI_OVERSOLD: payload.stockRsiOversold,
    SELECTED_CHAINID: payload.chainId,
    SELECTED_PROTOCOL: payload.selectedProtocol,
  };
}

async function fetchYearnVaultsData(chainId: number): Promise<YearnVault[]> {
  try {
    const apiURL = `https://ydaemon.yearn.fi/${chainId}/vaults/all`;
    const response = await fetch(apiURL);
    const data: YearnVault[] = await response.json();
    return data;
  } catch (error) {
    console.error("Failed to fetch Yearn Finance vaults:", error);
    return [];
  }
}

async function fetchTokenAddressByName(tokenSymbol: string, chainId: number): Promise<string | null> {
  try {
    const response = await fetch(TOKENS_URL);
    const data = await response.json();

    // Filtra i token per chainId e cerca un token che corrisponda al tokenSymbol fornito
    const matchingToken = data.tokens.find(
      (token: { chainId: number; symbol: string }) =>
        token.chainId === chainId && token.symbol.toLowerCase() === tokenSymbol.toLowerCase(),
    );

    // Se il token esiste, restituisci il suo indirizzo
    return matchingToken ? matchingToken.address : null;
  } catch (error) {
    console.error("Failed to fetch token address:", error);
    return null;
  }
}
