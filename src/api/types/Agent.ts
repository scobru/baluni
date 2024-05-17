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
  Agent,
  AgentMethodNames,
  AgentEventsContext,
  AgentEvents
>
export type AgentEvents = undefined
export interface AgentEventsContext {}
export type AgentMethodNames = 'new' | 'execute' | 'getRouter' | 'owner'
export interface CallsRequest {
  to: string
  value: string
  data: string | number[]
}
export interface Agent {
  /**
   * Payable: false
   * Constant: false
   * StateMutability: nonpayable
   * Type: constructor
   * @param _owner Type: address, Indexed: false
   * @param _router Type: address, Indexed: false
   */
  'new'(_owner: string, _router: string): MethodReturnContext
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
   */
  getRouter(): MethodConstantReturnContext<string>
  /**
   * Payable: false
   * Constant: true
   * StateMutability: view
   * Type: function
   */
  owner(): MethodConstantReturnContext<string>
}
