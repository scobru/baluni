export function checkWeightsSum(weights) {
  if (!weights) {
    console.log('Nessun peso disponibile per il controllo.')
    return
  }

  const totalWeight = Object.values(weights).reduce(
    (sum, weight) => Number(sum) + Number(weight),
    0
  )

  if (totalWeight === 10000) {
    console.log('La somma dei pesi è correttamente uguale a 10000.')
    return true
  } else {
    console.log(`La somma dei pesi è ${totalWeight}, non 10000.`)
    return false
  }
}
