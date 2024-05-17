import YEARN_VAULT_ABI from '../../abis/yearn/YearnVault.json'
import { BigNumber, ContractInterface, ethers } from 'ethers'
import { INFRA, NETWORKS } from '../../constants'
import routerAbi from '../../abis/infra/Router.json'

export async function redeemFromYearn(
  wallet: ethers.Wallet,
  pool: string,
  amount: BigNumber,
  receiver: string,
  chainId: string
) {
  try {
    const provider = new ethers.providers.JsonRpcProvider(NETWORKS[chainId])
    const vault = new ethers.Contract(
      pool,
      YEARN_VAULT_ABI as ContractInterface,
      wallet
    )
    const vaultBalance = await vault.balanceOf(receiver)
    const gasLimit = 9000000
    const gasPrice = await provider?.getGasPrice()
    const gas = gasPrice.add(gasPrice.div(10))

    if (vaultBalance.lt(amount)) {
      throw new Error('::API:: Insufficient balance')
    }

    const infraRouter = String(INFRA[chainId].ROUTER)
    const InfraRouterContract = new ethers.Contract(
      infraRouter,
      routerAbi,
      wallet
    )
    const agentAddress = await InfraRouterContract?.getAgentAddress(receiver)

    let Approvals = []
    let Calldatas = []
    let TokensReturn = []

    const allowanceAgent = await vault?.allowance(receiver, agentAddress)

    // Allowance for Agent
    // -------------------------------------------------------------------------
    if (allowanceAgent.lt(amount)) {
      console.log('::API::YEARN::REDEEM MISSING_ALLOWANCE_SENDER_FOR_AGENT')
      const approveData = vault.interface.encodeFunctionData('approve', [
        agentAddress,
        ethers.constants.MaxUint256,
      ])

      const approvalCalldata = {
        to: vault.address,
        value: 0,
        data: approveData,
        // gasLimit: gasLimit,
        // gasPrice: gas,
      }

      Approvals.push(approvalCalldata)
    } else {
      console.log('::API::YEARN::REDEEM FOUND_ALLOWANCE_SENDER_FOR_AGENT')
    }

    const allowanceAgentYearn = await vault?.allowance(agentAddress, pool)

    // Allowance for Yearn Vault
    // -------------------------------------------------------------------------
    if (allowanceAgentYearn.lt(amount)) {
      console.log('::API::YEARN::REDEEM MISSING_ALLOWANCE_AGENT_FOR_YEARN')
      const approveData = vault.interface.encodeFunctionData('approve', [
        pool,
        ethers.constants.MaxUint256,
      ])

      const approvalCalldata = {
        to: vault.address,
        value: 0,
        data: approveData,
        // gasLimit: gasLimit,
        // gasPrice: gas,
      }

      Calldatas.push(approvalCalldata)
    } else {
      console.log('::API::YEARN::REDEEM FOUND_ALLOWANCE_AGENT_FOR_YEARN')
    }

    // Transfer From
    // -------------------------------------------------------------------------
    const transferFromData = vault.interface.encodeFunctionData(
      'transferFrom',
      [receiver, agentAddress, amount]
    )

    const transferFromCalldata = {
      to: vault.address,
      value: 0,
      data: transferFromData,
      // gasLimit: gasLimit,
      // gasPrice: gas,
    }

    Calldatas.push(transferFromCalldata)

    if (transferFromCalldata)
      console.log('::API::YEARN::REDEEM BUILD_TRANSFER_FROM_SENDER_TO_AGENT')

    // Redeem
    // -------------------------------------------------------------------------
    const redeemData = vault.interface.encodeFunctionData(
      'redeem(uint256,address,address,uint256)',
      [amount, agentAddress, agentAddress, BigNumber.from(200)]
    )

    const redeemCalldata = {
      to: pool,
      value: 0,
      data: redeemData,
      // gasLimit: gasLimit,
      // gasPrice: gas,
    }

    Calldatas.push(redeemCalldata)
    if (redeemCalldata) console.log('::API::YEARN::REDEEM OK_REDEEM')

    const asset = await vault.asset()
    TokensReturn.push(asset)

    console.log('::API:: Approvals', Approvals.length)
    console.log('::API:: Calldatas', Calldatas.length)
    console.log('::API:: TokensReturn', TokensReturn.length)

    return {
      Approvals,
      Calldatas,
      TokensReturn,
    }
  } catch (e) {
    console.log(e)
  }
}

export async function redeemFromYearnBatched(
  redeems: Array<{
    wallet: ethers.Wallet
    pool: string
    amount: BigNumber
    receiver: string
    chainId: string
  }>
): Promise<{
  Approvals: Array<any>
  Calldatas: Array<any>
  TokensReturn: Array<string>
}> {
  let Approvals = []
  let Calldatas = []
  let TokensReturn = []

  for (let i = 0; i < redeems.length; i++) {
    const pool = redeems[i].pool
    const amount = redeems[i].amount
    const wallet = redeems[i].wallet
    const provider = new ethers.providers.JsonRpcProvider(
      NETWORKS[redeems[0].chainId]
    )
    const receiver = redeems[i].receiver
    const chainId = redeems[i].chainId
    const vault = new ethers.Contract(
      pool,
      YEARN_VAULT_ABI as ContractInterface,
      wallet
    )
    const vaultBalance = await vault.balanceOf(receiver)
    console.log(
      '::API::YEARN::REDEEM:BATCHED VAULT_BALANCE',
      Number(vaultBalance)
    )

    console.log('::API::YEARN::REDEEM:BATCHED AMOUNT', Number(amount))

    if (vaultBalance.lt(amount)) {
      throw new Error('::API::YEARN::REDEEM:BATCHED Insufficient balance')
    }

    const infraRouter = String(INFRA[chainId].ROUTER)
    const InfraRouterContract = new ethers.Contract(
      infraRouter,
      routerAbi,
      wallet
    )

    const agentAddress = await InfraRouterContract?.getAgentAddress(receiver)
    const allowanceAgent = await vault?.allowance(receiver, agentAddress)
    console.log('::API::YEARN::REDEEM:BATCHED AGENT', agentAddress)
    console.log(
      '::API::YEARN::REDEEM:BATCHED ALLOWANCE',
      Number(allowanceAgent)
    )

    // Allowance for Agent
    // -------------------------------------------------------------------------
    if (allowanceAgent.lt(amount)) {
      console.log(
        '::API::YEARN::REDEEM:BATCHED MISSING_ALLOWANCE_SENDER_FOR_AGENT'
      )
      const approveData = vault.interface.encodeFunctionData('approve', [
        agentAddress,
        ethers.constants.MaxUint256,
      ])

      const approvalCalldata = {
        to: vault.address,
        value: 0,
        data: approveData,
      }

      Approvals.push(approvalCalldata)
    } else {
      console.log(
        '::API::YEARN::REDEEM:BATCHED FOUND_ALLOWANCE_SENDER_FOR_AGENT'
      )
    }

    const allowanceAgentYearn = await vault?.allowance(agentAddress, pool)

    // Allowance for Yearn Vault
    // -------------------------------------------------------------------------
    if (allowanceAgentYearn.lt(amount)) {
      console.log('::API:: NO_ALLOWANCE_AGENT_FOR_YEARN')
      const approveData = vault.interface.encodeFunctionData('approve', [
        pool,
        ethers.constants.MaxUint256,
      ])

      const approvalCalldata = {
        to: vault.address,
        value: 0,
        data: approveData,
      }

      Calldatas.push(approvalCalldata)
    } else {
      console.log(
        '::API::YEARN::REDEEM:BATCHED FOUND_ALLOWANCE_AGENT_FOR_YEARN'
      )
    }

    // Transfer From
    // -------------------------------------------------------------------------
    // -------------------------------------------------------------------------

    const transferFromData = vault.interface.encodeFunctionData(
      'transferFrom',
      [receiver, agentAddress, amount]
    )

    const transferFromCalldata = {
      to: vault.address,
      value: 0,
      data: transferFromData,
    }

    if (transferFromCalldata)
      console.log(
        '::API::YEARN::REDEEM:BATCHED BUILD_TRANSFER_FROM_SENDER_TO_AGENT'
      )

    Calldatas.push(transferFromCalldata)

    // Redeem
    // -------------------------------------------------------------------------
    // -------------------------------------------------------------------------

    const redeemData = vault.interface.encodeFunctionData(
      'redeem(uint256,address,address,uint256)',
      [amount, agentAddress, agentAddress, BigNumber.from(200)]
    )

    const redeemCalldata = {
      to: pool,
      value: 0,
      data: redeemData,
    }

    Calldatas.push(redeemCalldata)

    if (redeemCalldata) console.log('::API::YEARN::REDEEM:BATCHED BUILD_REDEEM')

    const asset = await vault.asset()
    TokensReturn.push(asset)
  }

  console.log('::API::YEARN::REDEEM:BATCHED Approvals', Approvals.length)
  console.log('::API::YEARN::REDEEM:BATCHED Calldatas', Calldatas.length)
  console.log('::API::YEARN::REDEEM:BATCHED TokensReturn', TokensReturn.length)

  return {
    Approvals,
    Calldatas,
    TokensReturn,
  }
}
