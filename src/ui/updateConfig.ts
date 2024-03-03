import axios from "axios";

import * as Config from "../config-api";

// Definizione del tipo per la risposta attesa
interface ConfigResponse {
  TOKENS: string[];
  WEIGHTS_UP: Record<string, number>;
  WEIGHTS_DOWN: Record<string, number>;
  USDC: string;
  NATIVE: string;
  WRAPPED: string;
  WETH: string;
  ORACLE: string;
  ROUTER: string;
  QUOTER: string;
  FACTORY: string;
  NETWORKS: string;
  LIMIT: number;
  SLIPPAGE: number;
  INTERVAL: number;
  MAX_APPROVAL: boolean;
  INVESTMENT_INTERVAL: number;
  INVESTMENT_AMOUNT: number;
  TREND_FOLLOWING: boolean;
  KST_TIMEFRAME: string;
  PREDICTION: boolean;
  PREDICTION_PERIOD: number;
  PREDICTION_EPOCHS: number;
  PREDICTION_SYMBOL: string;
  PREDICTION_ALGO: string;
  TECNICAL_ANALYSIS: boolean;
  RSI_PERIOD: number;
  RSI_OVERBOUGHT: number;
  RSI_OVERSOLD: number;
  RSI_TIMEFRAME: string;
  STOCKRSI_PERIOD: number;
  STOCKRSI_OVERBOUGHT: number;
  STOCKRSI_OVERSOLD: number;
  EMA_TIMEFRAME: string;
  EMA_PERIOD: number;
  EMA_SYMBOL: string;
  EMA_FAST: number;
  EMA_SLOW: number;
  VWAP_PERIOD: number;
}

export async function updateConfig(tokens: string[], _weights: { [token: string]: number }, chainId: number) {
  try {
    // Dati da inviare all'API
    const payload = {
      tokens: tokens,
      weightsUp: _weights,
      weightsDown: _weights,
      chainId: chainId,
      yearnEnabled: Config.YEARN_ENABLED,
      yearnVaults: Config.YEARN_VAULTS,
      limit: Config.LIMIT,
      slippage: Config.SLIPPAGE,
      interval: Config.INTERVAL,
      maxApproval: Config.MAX_APPROVAL,
      investmentInterval: Config.INVESTMENT_INTERVAL,
      investmentAmount: Config.INVESTMENT_AMOUNT,
      trendFollowing: Config.TREND_FOLLOWING,
      kstTimeframe: Config.KST_TIMEFRAME,
      prediction: Config.PREDICTION,
      predictionPeriod: Config.PREDICTION_PERIOD,
      predictionEpochs: Config.PREDICTION_EPOCHS,
      predictionSymbol: Config.PREDICTION_SYMBOL,
      predictionAlgo: Config.PREDICTION_ALGO,
      tecnicalAnalysis: Config.TECNICAL_ANALYSIS,
      rsiPeriod: Config.RSI_PERIOD,
      rsiOverbought: Config.RSI_OVERBOUGHT,
      rsiOversold: Config.RSI_OVERSOLD,
      rsiTimeframe: Config.RSI_TIMEFRAME,
      stockRsiPeriod: Config.STOCKRSI_PERIOD,
      stockRsiOverbought: Config.STOCKRSI_OVERBOUGHT,
      stockRsiOversold: Config.STOCKRSI_OVERSOLD,
      emaTimeframe: Config.EMA_TIMEFRAME,
      emaPeriod: Config.EMA_PERIOD,
      emaSymbol: Config.EMA_SYMBOL,
      emaFast: Config.EMA_FAST,
      emaSlow: Config.EMA_SLOW,
      vwapPeriod: Config.VWAP_PERIOD,
    };

    // Esegui la richiesta POST
    const response = await axios.post<ConfigResponse>("https://baluni-api.scobrudot.dev/write-config", payload);

    // Gestisci la risposta
    console.log("Configurazione aggiornata:", response.data);

    return response.data;
  } catch (error) {
    console.error("Si è verificato un errore durante l'aggiornamento della configurazione:", error);
  }
}
