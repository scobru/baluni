import { writeConfig } from "./writeConfig";
import * as Config from "./config-api";

export async function updateConfig() {
  try {
    // Dati da inviare all'API
    const payload = {
      tokens: Config.TOKENS,
      weightsUp: Config.WEIGHTS_UP,
      weightsDown: Config.WEIGHTS_DOWN,
      chainId: Config.SELECTED_CHAINID,
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

    const response = await writeConfig(payload);

    // Gestisci la risposta
    // console.log("Configurazione aggiornata:", response);

    return response;
  } catch (error) {
    console.error("Si è verificato un errore durante l'aggiornamento della configurazione:", error);
  }
}

// Esegui la funzione
updateConfig();
