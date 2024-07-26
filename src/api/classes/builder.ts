import { Contract, Signer, ethers } from 'ethers'
import erc20Abi from 'baluni-contracts/abis/common/ERC20.json'
import routerAbi from 'baluni-contracts/artifacts/contracts/orchestators/BaluniV1Router.sol/BaluniV1Router.json'
import factoryAbi from 'baluni-contracts/artifacts/contracts/orchestators/BaluniV1AgentFactory.sol/BaluniV1AgentFactory.json'
import registryAbi from 'baluni-contracts/artifacts/contracts/registry/BaluniV1Registry.sol/BaluniV1Registry.json'
import { INFRA } from '../constants'

/**
 * Represents a Builder class.
 * @class
 */
export class Builder {
  public registryCtx: Contract
  public baluniRouterCtx: Contract
  public agentFactoryCtx: Contract
  public agentAddress: string
  public signer: Signer
  public sender: string

  /**
   * Represents a Builder class.
   * @class
   */
  constructor(_signer: Signer) {
    this.signer = _signer
  }

  /**
   * Builds a transaction by performing various operations such as checking agent existence,
   * creating agent if necessary, checking and setting allowances, and generating calldatas.
   *
   * @param approvalsForAgent - An array of objects representing approvals for the agent.
   * Each object should have properties: `to` (string), `data` (string), and `value` (string).
   * @param calldatas - An array of objects representing calldatas.
   * Each object should have properties: `to` (string), `data` (string), and `value` (string).
   * @param inputs - An array of objects representing input tokens.
   * Each object should have properties: `tokenAddress` (string) and `amount` (number).
   * @param outputs - An array of objects representing output tokens.
   * Each object should have properties: `tokenAddress` (string) and `amount` (number).
   * @returns An object containing the generated `approvals_sender`, `calldatas`, and `tokens_return`.
   * `approvals_sender` is an array of objects representing approvals for the sender.
   * `calldatas` is an array of objects representing the generated calldatas.
   * `tokens_return` is an array of token addresses.
   * @throws Error if the baluniRouterCtx is not set up or if failed to create agent.
   */
  async buildTransaction(
    approvals: Array<{ to: string; data: string; value: string }>,
    calldatas: Array<{ to: string; data: string; value: string }>,
    inputs: Array<{ tokenAddress: string; amount: string }>,
    outputs: Array<{ tokenAddress: string; amount: string }>
  ) {
    if (this.baluniRouterCtx === undefined) {
      throw new Error('::API::ODOS::BALUNI_ROUTER_NOT_FOUND, SETUP_REQUIRED')
    }

    if (this.agentAddress === ethers.constants.AddressZero) {
      console.log('::API::ODOS::AGENT_NOT_FOUND')
      const tx = await this.agentFactoryCtx.getOrCreateAgent(this.sender)
      await tx.wait()
      const agentAddressOnChain = await this.baluniRouterCtx?.getAgentAddress(
        this.sender
      )

      if (agentAddressOnChain === ethers.constants.AddressZero) {
        throw new Error('::API::ODOS::FAILED_TO_CREATE_AGENT')
      }
    }

    const tokens_return = outputs.map(token => token.tokenAddress)

    for (const token of inputs) {
      const tokenAContract = new Contract(
        token.tokenAddress,
        erc20Abi,
        this.signer.provider
      )

      const dataTransferFromSenderToAgent =
        tokenAContract.interface.encodeFunctionData('transferFrom', [
          this.sender,
          this.agentAddress,
          token.amount,
        ])

      const transferFromSenderToAgent = {
        to: token.tokenAddress,
        value: '0',
        data: dataTransferFromSenderToAgent,
      }

      if (transferFromSenderToAgent)
        console.log('::API::ODOS::BUILD_TRANSFER_FROM_SENDER_AGENT')
      calldatas = [transferFromSenderToAgent, ...calldatas]
    }

    return {
      approvals: approvals,
      calldatas: calldatas,
      tokens_return: tokens_return,
    }
  }

  /**
   * Sets up the builder by initializing the necessary contracts and addresses.
   * @param chainId - The chain ID to use for contract initialization.
   */
  async setup(chainId: number) {
    this.registryCtx = new Contract(
      INFRA[chainId].REGISTRY,
      registryAbi.abi,
      this.signer
    )

    const baluniRouterAddress = await this.registryCtx.getBaluniRouter()
    const agentFactoryAddress = await this.registryCtx.getBaluniAgentFactory()

    this.agentFactoryCtx = new Contract(
      agentFactoryAddress,
      factoryAbi.abi,
      this.signer
    )
    this.baluniRouterCtx = new Contract(
      baluniRouterAddress,
      routerAbi.abi,
      this.signer
    )
    this.sender = await this.signer.getAddress()
    this.agentAddress = await this.baluniRouterCtx?.getAgentAddress(
      await this.signer.getAddress()
    )
  }
}
