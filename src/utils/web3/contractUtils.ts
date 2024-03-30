import { BigNumber, Contract, ethers } from 'ethers'
import { loadPrettyConsole } from '../prettyConsole'

const pc = loadPrettyConsole()

export async function callContractMethod(
  contract: Contract,
  method: string,
  inputs: any[],
  provider: ethers.providers.JsonRpcProvider,
  gasPrice?: BigNumber,
  value?: BigNumber
) {
  console.log(`${method}(${inputs})`)

  let gasLimit = BigNumber.from(500000)

  let txResponse: any

  try {
    const gasEstimate: BigNumber = await contract.estimateGas[method](...inputs)
    gasLimit = gasEstimate.mul(2)
    console.log('Gas estimate:', gasEstimate.toBigInt())
    console.log('Gas limit:', gasLimit.toBigInt())
  } catch (error) {
    console.log('Default gas limit:', gasLimit.toBigInt())
  }

  // Simulate the transaction
  let simulationResult

  try {
    simulationResult = await contract.callStatic[method](...inputs, {
      gasPrice: gasPrice,
      gasLimit: gasLimit,
      value: value,
    })
    console.log('Simulation successful:', simulationResult)
  } catch (error) {
    console.error('Simulation failed:', error)
    return // Abort if simulation fails
  }

  txResponse = await contract[method](...inputs, {
    gasPrice: gasPrice,
    gasLimit: gasLimit,
    value: value,
  })

  pc.success('🎉 Done! Tx Hash:', txResponse.hash)

  return txResponse
}

export async function simulateContractMethod(
  contract: Contract,
  method: string,
  inputs: any[],
  gasPrice: BigNumber
) {
  console.log(`${method}(${inputs})`)

  let gasLimit = BigNumber.from(500000)

  try {
    const gasEstimate: BigNumber = await contract.estimateGas[method](...inputs)
    const gasLimit = gasEstimate.mul(2)
    console.log('Gas estimate:', gasEstimate.toBigInt())
    console.log('   Gas limit:', gasLimit.toBigInt())
  } catch (error) {
    console.log('Default gas limit:', gasLimit.toBigInt())
  }

  const txResponse = await contract.callStatic[method](...inputs, {
    gasPrice,
    gasLimit,
  })
  console.log('Simulate! Tx:', txResponse)
  return txResponse
}
