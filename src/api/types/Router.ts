import BN from 'bn.js'
import BigNumber from 'bignumber.js'
import {
  PromiEvent,
  TransactionReceipt,
  EventResponse,
  EventData,
  Web3ContractContext,
} from 'ethereum-abi-types-generator'

export interface CallOptions {
  from?: string
  gasPrice?: string
  gas?: number
}

export interface SendOptions {
  from: string
  value?: number | string | BN | BigNumber
  gasPrice?: string
  gas?: number
}

export interface EstimateGasOptions {
  from?: string
  value?: number | string | BN | BigNumber
  gas?: number
}

export interface MethodPayableReturnContext {
  send(options: SendOptions): PromiEvent<TransactionReceipt>
  send(
    options: SendOptions,
    callback: (error: Error, result: any) => void
  ): PromiEvent<TransactionReceipt>
  estimateGas(options: EstimateGasOptions): Promise<number>
  estimateGas(
    options: EstimateGasOptions,
    callback: (error: Error, result: any) => void
  ): Promise<number>
  encodeABI(): string
}

export interface MethodConstantReturnContext<TCallReturn> {
  call(): Promise<TCallReturn>
  call(options: CallOptions): Promise<TCallReturn>
  call(
    options: CallOptions,
    callback: (error: Error, result: TCallReturn) => void
  ): Promise<TCallReturn>
  encodeABI(): string
}

export interface MethodReturnContext extends MethodPayableReturnContext {}

export type ContractContext = Web3ContractContext<
  Router,
  RouterMethodNames,
  RouterEventsContext,
  RouterEvents
>
export type RouterEvents = 'AgentCreated' | 'OwnershipTransferred'
export interface RouterEventsContext {
  AgentCreated(
    parameters: {
      filter?: {}
      fromBlock?: number
      toBlock?: 'latest' | number
      topics?: string[]
    },
    callback?: (error: Error, event: EventData) => void
  ): EventResponse
  OwnershipTransferred(
    parameters: {
      filter?: {
        previousOwner?: string | string[]
        newOwner?: string | string[]
      }
      fromBlock?: number
      toBlock?: 'latest' | number
      topics?: string[]
    },
    callback?: (error: Error, event: EventData) => void
  ): EventResponse
}
export type RouterMethodNames =
  | 'new'
  | 'execute'
  | 'getAgentAddress'
  | 'getBytecode'
  | 'owner'
  | 'renounceOwnership'
  | 'transferOwnership'
  | 'userAgents'
  | 'withdraw'
  | 'withdrawToken'
export interface AgentCreatedEventEmittedResponse {
  user: string
  agent: string
}
export interface OwnershipTransferredEventEmittedResponse {
  previousOwner: string
  newOwner: string
}
export interface CallsRequest {
  to: string
  value: string
  data: string | number[]
}
export interface Router {
  /**
   * Payable: false
   * Constant: false
   * StateMutability: nonpayable
   * Type: constructor
   */
  'new'(): MethodReturnContext
  /**
   * Payable: false
   * Constant: false
   * StateMutability: nonpayable
   * Type: function
   * @param calls Type: tuple[], Indexed: false
   * @param tokensReturn Type: address[], Indexed: false
   */
  execute(calls: CallsRequest[], tokensReturn: string[]): MethodReturnContext
  /**
   * Payable: false
   * Constant: true
   * StateMutability: view
   * Type: function
   * @param _user Type: address, Indexed: false
   */
  getAgentAddress(_user: string): MethodConstantReturnContext<string>
  /**
   * Payable: false
   * Constant: true
   * StateMutability: view
   * Type: function
   * @param _owner Type: address, Indexed: false
   */
  getBytecode(_owner: string): MethodConstantReturnContext<string>
  /**
   * Payable: false
   * Constant: true
   * StateMutability: view
   * Type: function
   */
  owner(): MethodConstantReturnContext<string>
  /**
   * Payable: false
   * Constant: false
   * StateMutability: nonpayable
   * Type: function
   */
  renounceOwnership(): MethodReturnContext
  /**
   * Payable: false
   * Constant: false
   * StateMutability: nonpayable
   * Type: function
   * @param newOwner Type: address, Indexed: false
   */
  transferOwnership(newOwner: string): MethodReturnContext
  /**
   * Payable: false
   * Constant: true
   * StateMutability: view
   * Type: function
   * @param parameter0 Type: address, Indexed: false
   */
  userAgents(parameter0: string): MethodConstantReturnContext<string>
  /**
   * Payable: false
   * Constant: false
   * StateMutability: nonpayable
   * Type: function
   */
  withdraw(): MethodReturnContext
  /**
   * Payable: false
   * Constant: false
   * StateMutability: nonpayable
   * Type: function
   * @param token Type: address, Indexed: false
   */
  withdrawToken(token: string): MethodReturnContext
}
