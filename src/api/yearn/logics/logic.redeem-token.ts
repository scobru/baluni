import { ContractInterface, ethers, Signer } from 'ethers'
import YEARN_VAULT_ABI from '../../abis/yearn/YearnVault.json'
import ERC20ABI from 'baluni-contracts/abis/common/ERC20.json'
import { Builder } from '../../classes/builder'

export class RedeemTokenLogic {
  static id = 'redeem-token'
  static protocolId = 'yearn'

  public signer: Signer

  constructor(_signer: Signer) {
    this.signer = _signer
  }

  get id() {
    return RedeemTokenLogic.id
  }

  get protocolId() {
    return RedeemTokenLogic.protocolId
  }

  async build(
    redeems: Array<{
      pool: string
      amount: string
      receiver: string
      chainId: string
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

    for (const data of redeems) {
      const i = redeems.indexOf(data)
      const pool = redeems[i].pool
      const amount = redeems[i].amount
      const receiver = redeems[i].receiver
      const vault = new ethers.Contract(
        pool,
        YEARN_VAULT_ABI as ContractInterface,
        this.signer
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

      const InfraRouterContract = builder.baluniRouterCtx

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

        approvals.push(approvalCalldata)
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

        calldatas.push(approvalCalldata)
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

      calldatas.push(transferFromCalldata)

      // Redeem
      // -------------------------------------------------------------------------
      // -------------------------------------------------------------------------

      const redeemData = vault.interface.encodeFunctionData(
        'redeem(uint256,address,address,uint256)',
        [amount, agentAddress, agentAddress, BigInt(200)]
      )

      const redeemCalldata = {
        to: pool,
        value: 0,
        data: redeemData,
      }

      calldatas.push(redeemCalldata)

      if (redeemCalldata)
        console.log('::API::YEARN::REDEEM:BATCHED BUILD_REDEEM')

      const asset = await vault.asset()
      outputs.push(asset)
      inputs.push(pool)
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
