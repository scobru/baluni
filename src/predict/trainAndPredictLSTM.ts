import * as tf from "@tensorflow/tfjs";
import { loadPrettyConsole } from "../utils/prettyConsole";

const prettyConsole = loadPrettyConsole();

export async function trainAndPredictLSTM(
  timeAndPriceData: any[],
  newTimestamp: number,
  epochs: number
) {
  // Extract and normalize training data
  const timestamps = timeAndPriceData.map((d) => d[0]);
  const prices = timeAndPriceData.map((d) => d[1]);

  const minTimestamp = Math.min(...timestamps);
  const maxTimestamp = Math.max(...timestamps);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);

  // Normalize data
  const normalizedTimestamps = timestamps.map(
    (ts) => (ts - minTimestamp) / (maxTimestamp - minTimestamp)
  );
  const normalizedPrices = prices.map(
    (p) => (p - minPrice) / (maxPrice - minPrice)
  );

  // Create tensors

  const X = tf
    .tensor2d(normalizedTimestamps, [normalizedTimestamps.length, 1])
    .reshape([-1, 1, 1]);
  const y = tf.tensor2d(normalizedPrices, [normalizedPrices.length, 1]); // No need to reshape for 1D output

  // Create model
  const model = tf.sequential();

  /* model.add(tf.layers.dense({ units: 1, inputShape: [1] }));
  model.add(tf.layers.dense({ units: 1, inputShape: [1] }));
  model.add(tf.layers.dense({ units: 1, inputShape: [1] })); */

  // Final LSTM layer before Dense layers
  model.add(
    tf.layers.lstm({ inputShape: [1, 1], units: 20, returnSequences: false })
  );

  // Optional dropout for regularization
  model.add(tf.layers.dropout({ rate: 0.2 }));

  // Dense layer for regression output
  model.add(tf.layers.dense({ units: 1, activation: "sigmoid" }));

  // Compile model with a regression-appropriate loss function
  model.compile({
    optimizer: tf.train.adam(0.001),
    loss: "meanSquaredError",
    metrics: ["mae"], // Mean Absolute Error as a metric for regression
  });

  // Ensure y_reshaped is corrected for regression (2D shape: [samples, outputSize])
  const y_reshaped_corrected = y.reshape([y.shape[0], 1]);

  // Train model
  await model.fit(X, y_reshaped_corrected, {
    epochs: epochs,
  });

  // Predict
  const normalizedNewTimestamp =
    (newTimestamp - minTimestamp) / (maxTimestamp - minTimestamp);
  const normalizedPredictedPrice = model.predict(
    tf.tensor2d([normalizedNewTimestamp], [1, 1]).reshape([1, 1, 1])
  ) as tf.Tensor;

  // Scale back prediction
  const predictedPrice = normalizedPredictedPrice
    .mul(maxPrice - minPrice)
    .add(minPrice);

  // Evaluate model if you have separate test data
  await evaluateModel(timeAndPriceData, model);

  return predictedPrice.dataSync()[0];
}

export async function evaluateModel(testData: any[], model: any) {
  // Extract test data and normalize using training data min/max
  const testTimestamps = testData.map((d) => d[0]);
  const testPrices = testData.map((d) => d[1]);
  const minTimestamp = Math.min(...testTimestamps);
  const maxTimestamp = Math.max(...testTimestamps);
  const minPrice = Math.min(...testPrices);
  const maxPrice = Math.max(...testPrices);
  const normalizedTestTimestamps = testTimestamps.map(
    (ts) => (ts - minTimestamp) / (maxTimestamp - minTimestamp)
  );
  const normalizedTestPrices = testPrices.map(
    (p) => (p - minPrice) / (maxPrice - minPrice)
  );

  // Create tensors
  const X_test = tf.tensor2d(normalizedTestTimestamps, [
    normalizedTestTimestamps.length,
    1,
  ]);
  const y_test = tf.tensor2d(normalizedTestPrices, [
    normalizedTestPrices.length,
    1,
  ]);

  const X_reshaped = X_test.reshape([X_test.shape[0], 1, X_test.shape[1]]);
  const y_reshaped = y_test.reshape([y_test.shape[0], 1, y_test.shape[1]]);

  // Predict
  const predictions = model.predict(X_reshaped) as tf.Tensor;

  // Calculate metrics
  const mae = tf.metrics.meanAbsoluteError(y_reshaped, predictions);
  const mse = tf.metrics.MSE(y_reshaped, predictions);
  const mape = tf.metrics.MAPE(y_reshaped, predictions);

  // mean/median value of mae
  const meanMAE = mae.mean();
  const meanMSE = mse.mean();
  const meanMAPE = mape.mean();

  console.log(
    `MAPE: ${meanMAPE.dataSync()}, MAE: ${meanMAE.dataSync()}, MSE: ${meanMSE.dataSync()}, Corr: ${calculatePearsonCorrelation(
      y_test.flatten(),
      predictions.flatten()
    )}`
  );
}

function calculatePearsonCorrelation(
  y_true: tf.Tensor<tf.Rank>,
  y_pred: tf.Tensor<tf.Rank>
): number {
  return tf.tidy(() => {
    const meanYTrue = y_true.mean();
    const meanYPred = y_pred.mean();
    const centeredYTrue = y_true.sub(meanYTrue);
    const centeredYPred = y_pred.sub(meanYPred);
    const numerator = centeredYTrue.mul(centeredYPred).sum();
    const yTrueVar = centeredYTrue.square().sum().sqrt();
    const yPredVar = centeredYPred.square().sum().sqrt();
    return numerator.div(yTrueVar.mul(yPredVar)).dataSync()[0];
  });
}
