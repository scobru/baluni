import erc20Abi from 'baluni-contracts/abis/common/ERC20.json'
import { ethers, Signer } from 'ethers'
import { INFRA, PROTOCOLS } from '../../constants'

export interface QuoteParams {
  chainId: number // Replace with desired chainId
  inputTokens: { tokenAddress: string; amount: string }[]
  outputTokens: { tokenAddress: string; proportion: number }[]
  userAddr: string
  slippageLimitPercent: number // set your slippage limit percentage (1 = 1%)
}

export interface QuoteRequestBody {
  chainId: number
  inputTokens: { tokenAddress: string; amount: string }[]
  outputTokens: { tokenAddress: string; proportion: number }[]
  gasPrice: number
  userAddr: string
  slippageLimitPercent: number
  sourceBlacklist: string[]
  sourceWhitelist: string[]
  disableRFQs: boolean
  referralCode: number
  compact: boolean
  pathViz: boolean // Può essere specificato meglio se si conosce il tipo esatto

  pathVizImage: boolean
}

export interface QuoteRequestResponse {
  inTokens: string[]
  outTokens: string[]
  inAmounts: string[]
  outAmounts: string[]
  gasEstimate: number
  dataGasEstimate: number
  gweiPerGas: number
  gasEstimateValue: number
  inValues: number[]
  outValues: number[]
  netOutValue: number
  priceImpact: number
  percentDiff: number
  partnerFeePercent: number
  pathId: string
  blockNumber: number
}

interface TokenData {
  tokenAddress: string
  amount: string
}

export class SwapTokenLogic {
  static id = 'swap-token'
  static protocolId = 'odos'
  public odosRouterAddress: string
  public baluniRouterAddress: string
  public signer: Signer

  constructor(_signer: Signer) {
    this.signer = _signer
  }

  get id() {
    return SwapTokenLogic.id
  }

  get protocolId() {
    return SwapTokenLogic.protocolId
  }

  async setup(chainId: number) {
    this.odosRouterAddress = PROTOCOLS[chainId].odos.ROUTER
    this.baluniRouterAddress = INFRA[chainId].ROUTER
  }

  async quote(params: QuoteParams): Promise<QuoteRequestResponse> {
    if (this.odosRouterAddress === undefined) {
      throw new Error('::API::ODOS::ROUTER_NOT_FOUND, SETUP_REQUIRED')
    }
    const quoteRequestBody: QuoteRequestBody = {
      chainId: params.chainId,
      inputTokens: params.inputTokens,
      outputTokens: params.outputTokens,
      gasPrice: 100,
      userAddr: params.userAddr,
      slippageLimitPercent: params.slippageLimitPercent,
      sourceBlacklist: [],
      sourceWhitelist: [],
      disableRFQs: true,
      referralCode: 3844415834,
      compact: true,
      pathVizImage: true,
      pathViz: true,
    }

    console.log('Get Response from ODOS api..', quoteRequestBody)

    const responseQuote = await fetch('https://api.odos.xyz/sor/quote/v2', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(quoteRequestBody),
    })

    if (responseQuote.status === 200) {
      return await responseQuote.json()
    } else {
      throw new Error('Error in Quote')
    }
  }

  async build(
    sender: string,
    agentAddress: string,
    quote: QuoteRequestResponse
  ) {
    console.log(quote)

    if (this.odosRouterAddress === undefined) {
      throw new Error('::API::ODOS::ROUTER_NOT_FOUND, SETUP_REQUIRED')
    }

    const approvals: { to: string; value: string; data: string }[] = []
    const calldatas: { to: string; value: string; data: string }[] = []

    const inputs: TokenData[] = quote.inTokens.map((token, index) => ({
      tokenAddress: token,
      amount: quote.inAmounts[index],
    }))

    console.log('Inputs:', inputs)

    const outputs: TokenData[] = quote.outTokens.map((token, index) => ({
      tokenAddress: token,
      amount: quote.outAmounts[index],
    }))

    console.log('Outputs:', outputs)

    for (const token of quote.inTokens) {
      const tokenContract = new ethers.Contract(token, erc20Abi, this.signer)
      const allowanceFromAgentToOdosRouter = await tokenContract?.allowance(
        agentAddress,
        this.odosRouterAddress
      )

      const adjAmount = ethers.BigNumber.from(
        quote.inAmounts[quote.inTokens.indexOf(token)]
      )

      if (adjAmount.gt(allowanceFromAgentToOdosRouter)) {
        console.log('::API::ODOS::MISSING_ALLOWANCE_USERADDRES_ODOS')

        const approvalDataParams = tokenContract.interface.encodeFunctionData(
          'approve',
          [this.odosRouterAddress, ethers.constants.MaxUint256]
        )

        const approvalTxData = {
          to: token,
          value: '0',
          data: approvalDataParams,
        }

        calldatas.push(approvalTxData)
      } else {
        console.log('::API::ODOS::FOUND_ALLOWANCE_AGENT_ODOS')
      }

      const allowanceFromSenderToAgentAddress = await tokenContract?.allowance(
        sender,
        agentAddress
      )

      if (adjAmount.gt(allowanceFromSenderToAgentAddress)) {
        console.log('::API::ODOS::MISSING_ALLOWANCE_SENDER_AGENT')

        const approvalDataParams = tokenContract.interface.encodeFunctionData(
          'approve',
          [agentAddress, ethers.constants.MaxUint256]
        )

        const approvalTxData = {
          to: token,
          value: '0',
          data: approvalDataParams,
        }

        approvals.push(approvalTxData)
      } else {
        console.log('::API::ODOS::FOUND_ALLOWANCE_SENDER_AGENT')
      }
    }

    const assembleRequestBody = {
      userAddr: agentAddress,
      pathId: quote.pathId,
      simulate: false,
    }

    const responseAssemble = await fetch('https://api.odos.xyz/sor/assemble', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(assembleRequestBody),
    })

    if (responseAssemble.status === 200) {
      const assembledTransaction = await responseAssemble.json()
      console.log('Assembled Tx', assembledTransaction)

      const tx = {
        to: assembledTransaction.transaction.to,
        value: String(assembledTransaction.transaction.value),
        data: assembledTransaction.transaction.data,
        gasLimit: String(assembledTransaction.transaction.gasPrice),
        gasPrice: String(assembledTransaction.transaction.gas),
      }
      calldatas.push(tx)
    } else {
      console.error('Error in Transaction Assembly:', responseAssemble)
    }

    return { approvals, calldatas, inputs, outputs }
  }
}
