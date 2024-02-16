import * as tf from "@tensorflow/tfjs";
import { PREDICTION_EPOCHS } from "../config"; // ensure this is correctly imported
import { loadPrettyConsole } from "../utils/prettyConsole";

const prettyConsole = loadPrettyConsole();

export async function trainAndPredictGRU(
  timeAndPriceData: any[],
  newTimestamp: number
) {
  // Extract and normalize training data
  const timestamps = timeAndPriceData.map((d) => d[0]);
  const prices = timeAndPriceData.map((d) => d[1]);

  const minTimestamp = Math.min(...timestamps);
  const maxTimestamp = Math.max(...timestamps);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);

  // Example of preparing input data
  const normalizedTimestamps = timestamps.map(
    (ts) => (ts - minTimestamp) / (maxTimestamp - minTimestamp)
  );
  const normalizedPrices = prices.map(
    (p) => (p - minPrice) / (maxPrice - minPrice)
  );

  // Assuming you've converted your data into tensors
  const X = tf
    .tensor2d(normalizedTimestamps, [normalizedTimestamps.length, 1])
    .reshape([-1, 1, 1]);
  const y = tf.tensor2d(normalizedPrices, [normalizedPrices.length, 1]);

  // Create model
  const model = tf.sequential();

  // Adding a GRU layer
  model.add(
    tf.layers.gru({
      inputShape: [1, 1], // Adjust based on your input data shape
      units: 20, // Number of GRU units
      returnSequences: false, // Set to true if adding more recurrent layers
    })
  );

  // Adding a dropout layer for regularization
  model.add(tf.layers.dropout({ rate: 0.2 }));

  // Output layer
  model.add(tf.layers.dense({ units: 1, activation: "linear" })); // Use 'linear' for regression tasks

  // Compile the model
  model.compile({
    optimizer: "adam",
    loss: "meanSquaredError",
    metrics: ["mae"], // Mean Absolute Error
  });

  // Ensure y_reshaped is corrected for regression (2D shape: [samples, outputSize])
  const y_reshaped_corrected = y.reshape([y.shape[0], 1]);

  // Train model
  await model.fit(X, y_reshaped_corrected, {
    epochs: PREDICTION_EPOCHS,
    batchSize: 32, // Adjust based on your data size
    validationSplit: 0.2, // Optional: Use a portion of your data for validation
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
