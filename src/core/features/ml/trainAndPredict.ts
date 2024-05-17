import * as tf from '@tensorflow/tfjs'
import { loadPrettyConsole } from '../../utils/prettyConsole'

const prettyConsole = loadPrettyConsole()

export async function trainAndPredict(
  timeAndPriceData: any[],
  newTimestamp: number,
  epochs: number
) {
  // Extract and normalize training data
  const timestamps = timeAndPriceData.map(d => d[0])
  const prices = timeAndPriceData.map(d => d[1])

  const minTimestamp = Math.min(...timestamps)
  const maxTimestamp = Math.max(...timestamps)
  const minPrice = Math.min(...prices)
  const maxPrice = Math.max(...prices)

  // Normalize data
  const normalizedTimestamps = timestamps.map(
    ts => (ts - minTimestamp) / (maxTimestamp - minTimestamp)
  )
  const normalizedPrices = prices.map(
    p => (p - minPrice) / (maxPrice - minPrice)
  )

  // Create tensors
  const X = tf.tensor2d(normalizedTimestamps, [normalizedTimestamps.length, 1])
  const y = tf.tensor2d(normalizedPrices, [normalizedPrices.length, 1])

  // Create model
  const model = tf.sequential()
  model.add(
    tf.layers.dense({ units: 1, inputShape: [1], activation: 'linear' })
  ) // Single layer for linear regression
  model.add(
    tf.layers.dense({ units: 1, inputShape: [1], activation: 'linear' })
  ) // Single layer for linear regression
  model.add(
    tf.layers.dense({ units: 1, inputShape: [1], activation: 'linear' })
  ) // Single layer for linear regression

  model.compile({
    optimizer: 'adam',
    loss: 'meanSquaredError',
    metrics: ['mae'], // Mean Absolute Error
  })

  // Train model
  await model.fit(X, y, { epochs: epochs })

  // Predict
  const normalizedNewTimestamp =
    (newTimestamp - minTimestamp) / (maxTimestamp - minTimestamp)
  const normalizedPredictedPrice = model.predict(
    tf.tensor2d([normalizedNewTimestamp], [1, 1])
  ) as tf.Tensor

  // Scale back prediction
  const predictedPrice = normalizedPredictedPrice
    .mul(maxPrice - minPrice)
    .add(minPrice)

  // Evaluate model if you have separate test data
  await evaluateModel(timeAndPriceData, model)

  console.log(predictedPrice.dataSync())

  return predictedPrice.dataSync()[0]
}

export async function evaluateModel(testData: any[], model: any) {
  // Extract test data and normalize using training data min/max
  const testTimestamps = testData.map(d => d[0])
  const testPrices = testData.map(d => d[1])
  const minTimestamp = Math.min(...testTimestamps)
  const maxTimestamp = Math.max(...testTimestamps)
  const minPrice = Math.min(...testPrices)
  const maxPrice = Math.max(...testPrices)
  const normalizedTestTimestamps = testTimestamps.map(
    ts => (ts - minTimestamp) / (maxTimestamp - minTimestamp)
  )
  const normalizedTestPrices = testPrices.map(
    p => (p - minPrice) / (maxPrice - minPrice)
  )

  // Create tensors
  const X_test = tf.tensor2d(normalizedTestTimestamps, [
    normalizedTestTimestamps.length,
    1,
  ])
  const y_test = tf.tensor2d(normalizedTestPrices, [
    normalizedTestPrices.length,
    1,
  ])

  // Predict
  const predictions = model.predict(X_test) as tf.Tensor

  // Calculate metrics
  const mae = tf.metrics.meanAbsoluteError(y_test, predictions)
  const mse = tf.metrics.MSE(y_test, predictions)

  const mape = tf.metrics.MAPE(y_test, predictions)

  // mean/median value of mae
  const meanMAE = mae.mean()
  const meanMSE = mse.mean()
  const meanMAPE = mape.mean()

  console.log(
    `MAPE: ${meanMAPE.dataSync()}, MAE: ${meanMAE.dataSync()}, MSE: ${meanMSE.dataSync()}, Corr: ${calculatePearsonCorrelation(
      y_test.flatten(),
      predictions.flatten()
    )}`
  )
}

function calculatePearsonCorrelation(
  y_true: tf.Tensor<tf.Rank>,
  y_pred: tf.Tensor<tf.Rank>
): number {
  return tf.tidy(() => {
    const meanYTrue = y_true.mean()
    const meanYPred = y_pred.mean()
    const centeredYTrue = y_true.sub(meanYTrue)
    const centeredYPred = y_pred.sub(meanYPred)
    const numerator = centeredYTrue.mul(centeredYPred).sum()
    const yTrueVar = centeredYTrue.square().sum().sqrt()
    const yPredVar = centeredYPred.square().sum().sqrt()
    return numerator.div(yTrueVar.mul(yPredVar)).dataSync()[0]
  })
}
