//import { PROTOCOLS, ORACLE, NATIVETOKENS, NETWORKS } from "baluni-api";
import { PROTOCOLS, ORACLE, NATIVETOKENS, NETWORKS } from "../../../baluni-api/dist";

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

const TOKENS_URL = "https://tokens.uniswap.org";

export async function writeConfig(config: any): Promise<any> {
  const updatedWeightsDown: Record<string, number> = {};
  const updatedWeightsUp: Record<string, number> = {};
  const updatedYearnVaults: Record<string, string> = {};
  const tokenAddresses = await Promise.all(
    config.tokens.map((tokenSymbol: string) => fetchTokenAddressByName(tokenSymbol, config.chainId)),
  );

  tokenAddresses.forEach((address, index) => {
    if (address) {
      updatedWeightsUp[address] = config.weightsUp[config.tokens[index]] ?? 0;
      updatedWeightsDown[address] = config.weightsDown[config.tokens[index]] ?? 0;
    }
  });

  // Se yearnEnabled è true, recupera i dati dei vault di Yearn
  if (config.yearnEnabled) {
    const yearnVaultsData = await fetchYearnVaultsData(config.chainId);

    // Itera sui token per cui sono configurati i vault di Yearn
    for (const [tokenSymbol, _config] of Object.entries(config.yearnVaults[config.chainId])) {
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
    USDC: await fetchTokenAddressByName("USDC.E", config.chainId),
    NATIVE: NATIVETOKENS[config.chainId]?.NATIVE,
    WRAPPED: NATIVETOKENS[config.chainId]?.WRAPPED,
    ORACLE: ORACLE[config.chainId]?.["1inch-spot-agg"]?.OFFCHAINORACLE,
    ROUTER: PROTOCOLS[config.chainId]?.["uni-v3"]?.ROUTER,
    QUOTER: PROTOCOLS[config.chainId]?.["uni-v3"]?.QUOTER,
    FACTORY: PROTOCOLS[config.chainId]?.["uni-v3"]?.FACTORY,
    NETWORKS: NETWORKS[config.chainId],
    YEARN_ENABLED: config.yearnEnabled,
    YEARN_VAULTS: updatedYearnVaults,
    LIMIT: config.limit,
    SLIPPAGE: config.slippage,
    INTERVAL: config.interval,
    MAX_APPROVAL: config.maxApproval,
    INVESTMENT_INTERVAL: config.investmentInterval,
    INVESTMENT_AMOUNT: config.investmentAmount,
    TREND_FOLLOWING: config.trendFollowing,
    KST_TIMEFRAME: config.kstTimeframe,
    PREDICTION: config.prediction,
    PREDICTION_PERIOD: config.predictionPeriod,
    PREDICTION_EPOCHS: config.predictionEpochs,
    PREDICTION_SYMBOL: config.predictionSymbol,
    PREDICTION_ALGO: config.predictionAlgo,
    TECNICAL_ANALYSIS: config.tecnicalAnalysis,
    RSI_PERIOD: config.rsiPeriod,
    RSI_OVERBOUGHT: config.rsiOverbought,
    RSI_OVERSOLD: config.rsiOversold,
    RSI_TIMEFRAME: config.rsiTimeframe,
    STOCKRSI_PERIOD: config.stockRsiPeriod,
    STOCKRSI_OVERBOUGHT: config.stockRsiOverbought,
    STOCKRSI_OVERSOLD: config.stockRsiOversold,
    EMA_TIMEFRAME: config.emaTimeframe,
    EMA_PERIOD: config.emaPeriod,
    EMA_SYMBOL: config.emaSymbol,
    EMA_FAST: config.emaFast,
    EMA_SLOW: config.emaSlow,
    VWAP_PERIOD: config.vwapPeriod,
    SELECTED_CHAINID: config.chainId,
    SELECTED_PROTOCOL: config.selectedProtocol,
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
