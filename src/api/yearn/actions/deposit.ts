import YEARN_VAULT_ABI from '../../abis/yearn/YearnVault.json'
import ERC20ABI from 'baluni-contracts/abis/common/ERC20.json'
import { BigNumber, Contract, ethers } from 'ethers'
import { INFRA, NETWORKS } from '../../constants'
import routerAbi from 'baluni-contracts/artifacts/contracts/orchestators/BaluniV1Router.sol/BaluniV1Router.json'
import registryAbi from 'baluni-contracts/artifacts/contracts/registry/BaluniV1Registry.sol/BaluniV1Registry.json'

export async function depositToYearn(
  wallet: ethers.Wallet,
  tokenAddr: string,
  pool: string,
  amount: BigNumber,
  receiver: string,
  chainId: string
) {
  try {
    const token = new ethers.Contract(tokenAddr, ERC20ABI, wallet)
    const vault = new ethers.Contract(pool, YEARN_VAULT_ABI, wallet)

    const tokenBalance = await token.balanceOf(receiver)
    const registry = new Contract(
      INFRA[chainId].REGISTRY,
      registryAbi.abi,
      wallet
    )
    const infraRouter = await registry.getBaluniRouter()

    const InfraRouterContract = new ethers.Contract(
      infraRouter,
      routerAbi.abi,
      wallet
    )
    const agentAddress = await InfraRouterContract?.getAgentAddress(receiver)

    if (tokenBalance.lt(amount)) {
      throw new Error('::API::YEARN::DEPOSIT Insufficient balance')
    }

    let Approvals = []
    let Calldatas = []
    let TokensReturn = []
    const allowanceAgent = await token?.allowance(receiver, agentAddress)
    console.log('::API::YEARN::DEPOSIT AGENT', agentAddress)
    console.log(
      '::API::YEARN::DEPOSIT ALLOWANCE_SENDER_FOR_AGENT',
      Number(allowanceAgent).toString()
    )
    console.log('::API:: AMOUNT', Number(amount).toString())

    // Sender Approval
    // -------------------------------------------------------------------------

    if (allowanceAgent.lt(amount)) {
      console.log('::API::YEARN::DEPOSIT MISSING_ALLOWANCE_SENDER_FOR_AGENT')
      const approveData = token.interface.encodeFunctionData('approve', [
        agentAddress,
        ethers.constants.MaxUint256,
      ])
      const approvalCalldata = {
        to: token.address,
        value: 0,
        data: approveData,
      }

      Approvals.push(approvalCalldata)
    } else {
      console.log('::API::YEARN::DEPOSIT FOUND_ALLOWANCE_SENDER_FOR_AGENT')
    }
    const allowanceYearn = await token?.allowance(agentAddress, pool)

    // Agents Calldatas
    // -------------------------------------------------------------------------
    if (allowanceYearn.lt(amount)) {
      console.log('::API::YEARN::DEPOSIT MISSING_ALLOWANCE_AGENT_FOR_YEARN')
      const approveData = token.interface.encodeFunctionData('approve', [
        pool,
        ethers.constants.MaxUint256,
      ])
      const approvalCalldata = {
        to: token.address,
        value: 0,
        data: approveData,
      }
      Calldatas.push(approvalCalldata)
    } else {
      console.log('::API::YEARN::DEPOSIT FOUND_ALLOWANCE_AGENT_FOR_YEARN')
    }

    // Transfer From
    // -------------------------------------------------------------------------
    const transferFromData = token.interface.encodeFunctionData(
      'transferFrom',
      [receiver, agentAddress, amount]
    )
    const transferFromCalldata = {
      to: token.address,
      value: 0,
      data: transferFromData,
    }
    Calldatas.push(transferFromCalldata)

    if (transferFromCalldata)
      console.log('::API::YEARN::DEPOSIT BUILD_TRANSFER_FROM_SENDER_TO_AGENT')

    // Deposit to Yearn
    // -------------------------------------------------------------------------
    const depositData = vault.interface.encodeFunctionData('deposit', [
      amount,
      agentAddress,
    ])
    const depositCalldata = {
      to: pool,
      value: 0,
      data: depositData,
    }

    if (depositCalldata)
      console.log('::API::YEARN::DEPOSIT BUILD_DEPOSIT_TO_YEARN')
    Calldatas.push(depositCalldata)
    TokensReturn.push(vault.address)
    console.log('::API::YEARN::DEPOSIT Approvals', Approvals.length)
    console.log('::API::YEARN::DEPOSIT Calldatas', Calldatas.length)
    console.log('::API::YEARN::DEPOSIT TokensReturn', TokensReturn.length)

    return {
      Approvals,
      Calldatas,
      TokensReturn,
    }
  } catch (e) {
    console.log(e)
  }
}

export async function depositToYearnBatched(
  deposits: Array<{
    wallet: ethers.Wallet
    tokenAddr: string
    pool: string
    amount: BigNumber
    receiver: string
    chainId: string
  }>
): Promise<{
  Approvals: Array<any> // Specify the type argument for the Array type
  Calldatas: Array<any>
  TokensReturn: Array<string>
}> {
  let Approvals = []
  let Calldatas = []
  let TokensReturn = []

  for (let i = 0; i < deposits.length; i++) {
    const pool = deposits[i].pool
    const amount = deposits[i].amount
    const wallet = deposits[i].wallet
    const receiver = deposits[i].receiver
    const tokenAddr = deposits[i].tokenAddr
    const chainId = deposits[i].chainId
    const token = new ethers.Contract(tokenAddr, ERC20ABI, wallet)
    const vault = new ethers.Contract(pool, YEARN_VAULT_ABI, wallet)
    const tokenBalance = await token.balanceOf(receiver)
    const infraRouter = String(INFRA[chainId].ROUTER)
    const InfraRouterContract = new ethers.Contract(
      infraRouter,
      routerAbi.abi,
      wallet
    )
    const agentAddress = await InfraRouterContract?.getAgentAddress(receiver)

    if (tokenBalance.lt(amount)) {
      throw new Error('::API::YEARN::DEPOSIT:BATCHED Insufficient balance')
    }

    const allowanceAgent = await token?.allowance(receiver, agentAddress)
    console.log('::API::YEARN::DEPOSIT:BATCHED AGENT', agentAddress)
    console.log(
      '::API::YEARN::DEPOSIT:BATCHED ALLOWANCE_SENDER_FOR_AGENT',
      Number(allowanceAgent).toString()
    )

    // Sender Approval
    // -------------------------------------------------------------------------

    if (allowanceAgent.lt(amount)) {
      console.log(
        '::API::YEARN::DEPOSIT:BATCHED MISSING_ALLOWANCE_SENDER_FOR_AGENT'
      )
      const approveData = token.interface.encodeFunctionData('approve', [
        agentAddress,
        ethers.constants.MaxUint256,
      ])

      const approvalCalldata = {
        to: token.address,
        value: 0,
        data: approveData,
      }

      Approvals.push(approvalCalldata)
    } else {
      console.log(
        '::API::YEARN::DEPOSIT:BATCHED FOUND_ALLOWANCE_SENDER_FOR_AGENT'
      )
    }

    const allowanceYearn = await token?.allowance(agentAddress, pool)
    console.log('ALLOWANCE_AGENT_FOR_YEARN', Number(allowanceYearn).toString())

    // Agents Calldatas
    // -------------------------------------------------------------------------
    if (allowanceYearn.lt(amount)) {
      console.log(
        '::API::YEARN::DEPOSIT:BATCHED MISSING_ALLOWANCE_AGENT_FOR_YEARN'
      )
      const approveData = token.interface.encodeFunctionData('approve', [
        pool,
        ethers.constants.MaxUint256,
      ])

      const approvalCalldata = {
        to: token.address,
        value: 0,
        data: approveData,
      }

      Calldatas.push(approvalCalldata)
    } else {
      console.log(
        '::API::YEARN::DEPOSIT:BATCHED FOUND_ALLOWANCE_AGENT_FOR_YEARN'
      )
    }

    // Transfer From
    // -------------------------------------------------------------------------
    const transferFromData = token.interface.encodeFunctionData(
      'transferFrom',
      [receiver, agentAddress, amount]
    )

    const transferFromCalldata = {
      to: token.address,
      value: 0,
      data: transferFromData,
    }

    Calldatas.push(transferFromCalldata)

    if (transferFromCalldata)
      console.log(
        '::API::YEARN::DEPOSIT:BATCHED BUILD_TRANSFER_FROM_SENDER_TO_AGENT'
      )

    // Deposit to Yearn
    // -------------------------------------------------------------------------
    const depositData = vault.interface.encodeFunctionData('deposit', [
      amount,
      agentAddress,
    ])

    const depositCalldata = {
      to: pool,
      value: 0,
      data: depositData,
    }

    if (depositCalldata)
      console.log('::API::YEARN::DEPOSIT:BATCHED BUILD_DEPOSIT_TO_YEARN')

    Calldatas.push(depositCalldata)
    TokensReturn.push(vault.address)
  }

  console.log('::API::YEARN::DEPOSIT:BATCHED Approvals', Approvals.length)
  console.log('::API::YEARN::DEPOSIT:BATCHED Calldatas', Calldatas.length)
  console.log('::API::YEARN::DEPOSIT:BATCHED TokensReturn', TokensReturn.length)

  return {
    Approvals,
    Calldatas,
    TokensReturn,
  }
}
