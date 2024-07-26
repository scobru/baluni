import { ethers, Signer } from 'ethers'
import YEARN_VAULT_ABI from '../../abis/yearn/YearnVault.json'
import ERC20ABI from 'baluni-contracts/abis/common/ERC20.json'
import { Builder } from '../../classes/builder'

export class DepositTokenLogic {
  static id = 'deposit-token'
  static protocolId = 'yearn'

  public signer: Signer

  constructor(_signer: Signer) {
    this.signer = _signer
  }

  get id() {
    return DepositTokenLogic.id
  }

  get protocolId() {
    return DepositTokenLogic.protocolId
  }

  async build(
    deposits: Array<{
      chainId: string
      tokenAddr: string
      pool: string
      amount: string
      receiver: string
    }>
  ): Promise<{
    approvals: Array<unknown>[]
    calldatas: Array<unknown>[]
    inputs: Array<string>[]
    outputs: Array<string>[]
  }> {
    const builder = new Builder(this.signer)

    const approvals = []
    const calldatas = []
    const inputs = []
    const outputs = []

    for (const deposit of deposits) {
      const i = deposits.indexOf(deposit)

      const pool = deposits[i].pool
      const amount = deposits[i].amount
      const receiver = deposits[i].receiver
      const tokenAddr = deposits[i].tokenAddr
      const token = new ethers.Contract(tokenAddr, ERC20ABI, this.signer)
      const vault = new ethers.Contract(pool, YEARN_VAULT_ABI, this.signer)
      const tokenBalance = await token.balanceOf(receiver)
      const agentAddress = builder.agentAddress

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

        approvals.push(approvalCalldata)
      } else {
        console.log(
          '::API::YEARN::DEPOSIT:BATCHED FOUND_ALLOWANCE_SENDER_FOR_AGENT'
        )
      }

      const allowanceYearn = await token?.allowance(agentAddress, pool)
      console.log(
        'ALLOWANCE_AGENT_FOR_YEARN',
        Number(allowanceYearn).toString()
      )

      // Agents Calldatas

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

        calldatas.push(approvalCalldata)
      } else {
        console.log(
          '::API::YEARN::DEPOSIT:BATCHED FOUND_ALLOWANCE_AGENT_FOR_YEARN'
        )
      }

      // Transfer From

      const transferFromData = token.interface.encodeFunctionData(
        'transferFrom',
        [receiver, agentAddress, amount]
      )

      const transferFromCalldata = {
        to: token.address,
        value: 0,
        data: transferFromData,
      }

      calldatas.push(transferFromCalldata)

      if (transferFromCalldata)
        console.log(
          '::API::YEARN::DEPOSIT:BATCHED BUILD_TRANSFER_FROM_SENDER_TO_AGENT'
        )

      // Deposit to Yearn

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

      calldatas.push(depositCalldata)
      outputs.push(vault.address)
      inputs.push(tokenAddr)
    }

    console.log('::API::YEARN::DEPOSIT:BATCHED Approvals', approvals.length)
    console.log('::API::YEARN::DEPOSIT:BATCHED Calldatas', calldatas.length)
    console.log('::API::YEARN::DEPOSIT:BATCHED TokensReturn', outputs.length)

    return {
      approvals,
      calldatas,
      inputs,
      outputs,
    }
  }
}
