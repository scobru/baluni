import { Contract, Wallet, ethers } from 'ethers'
import erc20Abi from 'baluni-contracts/abis/common/ERC20.json'
import routerAbi from 'baluni-contracts/artifacts/contracts/orchestators/BaluniV1Router.sol/BaluniV1Router.json'
import factoryAbi from 'baluni-contracts/artifacts/contracts/orchestators/BaluniV1AgentFactory.sol/BaluniV1AgentFactory.json'
import registryAbi from 'baluni-contracts/artifacts/contracts/registry/BaluniV1Registry.sol/BaluniV1Registry.json'
import env from 'dotenv'
import { ODOS_ASSEMBLE, ODOS_QUOTE, PROTOCOLS, INFRA } from '../../constants'

env.config()

export async function buildSwapOdos(
  wallet: Wallet,
  sender: string,
  chainId: string,
  inputTokens: Array<{ tokenAddress: string; amount: string }>,
  outputTokens: Array<{ tokenAddress: string; proportion: number }>,
  slippageLimitPercent: number,
  referralCode: number,
  disableRFQs: boolean,
  compact: boolean
) {
  console.log('Building Batch Swap tx')

  const registry = new Contract(
    INFRA[chainId].REGISTRY,
    registryAbi.abi,
    wallet
  )

  const odosRouter = String(PROTOCOLS[chainId]['odos'].ROUTER)
  const infraRouter = await registry.getBaluniRouter()
  const agentFactory = await registry.getBaluniAgentFactory()

  const InfraRouterContract = new Contract(infraRouter, routerAbi.abi, wallet)
  let agentAddress = await InfraRouterContract?.getAgentAddress(sender)

  if (agentAddress === ethers.constants.AddressZero) {
    const factoryCtx = new Contract(agentFactory, factoryAbi.abi, wallet)
    const tx = await factoryCtx.getOrCreateAgent(sender)
    tx.wait()
    agentAddress = await InfraRouterContract?.getAgentAddress(sender)
  }

  const Approvals = []
  const ApprovalsAgent = []

  const Calldatas = []
  const TokensReturn = []

  console.log('::API::ODOS::ROUTER', infraRouter)

  for (const token of inputTokens) {
    console.log('::API::ODOS::AGENT', agentAddress)
    console.log('::API::ODOS::TOKEN_A', token.tokenAddress)

    const tokenAContract = new Contract(token.tokenAddress, erc20Abi, wallet)
    const adjAmount = ethers.BigNumber.from(token.amount)

    // Allowance for Sender to Agent
    // ----------------------------------------------------------------------------
    // ----------------------------------------------------------------------------
    const allowanceAgent = await tokenAContract?.allowance(sender, agentAddress)

    if (adjAmount.gt(allowanceAgent)) {
      console.log('::API::ODOS::MISSING_ALLOWANCE_SENDER_AGENT')

      const dataApproveToAgent = tokenAContract?.interface.encodeFunctionData(
        'approve',
        [agentAddress, ethers.constants.MaxUint256]
      )
      const approvalToAgent = {
        to: token.tokenAddress,
        value: 0,
        data: dataApproveToAgent,
      }

      Approvals.push(approvalToAgent)
    } else {
      console.log('::API::ODOS::FOUND_ALLOWANCE_SENDER_AGENT')
    }

    // Allowance for Sender to Router
    // ----------------------------------------------------------------------------
    // ----------------------------------------------------------------------------
    // const allowanceSenderRouter = await tokenAContract?.allowance(
    //   sender,
    //   infraRouter
    // )

    // if (adjAmount.gt(allowanceSenderRouter)) {
    //   console.log(
    //     '::API::ODOS::BUILDSWAP:BATCHED MISSING_ALLOWANCE_SENDER_TO_ROUTER'
    //   )

    //   const dataApproveToRouter = tokenAContract?.interface.encodeFunctionData(
    //     'approve',
    //     [infraRouter, ethers.constants.MaxUint256]
    //   )
    //   const approvalToRouter = {
    //     to: token.tokenAddress,
    //     value: 0,
    //     data: dataApproveToRouter,
    //   }

    //   Approvals.push(approvalToRouter)
    // } else {
    //   console.log(
    //     '::API::ODOS::BUILDSWAP:BATCHED FOUND_ALLOWANCE_SENDER_TO_ROUTER'
    //   )
    // }

    // Allowance for Agent to OdosRouter
    // ----------------------------------------------------------------------------
    // ----------------------------------------------------------------------------
    const allowanceAgentToOdosRouter = await tokenAContract?.allowance(
      agentAddress,
      odosRouter
    )

    if (adjAmount.gt(allowanceAgentToOdosRouter)) {
      console.log('::API::ODOS::MISSING_ALLOWANCE_AGENT_ODOS')

      const dataApproveToOdosROuter =
        tokenAContract?.interface.encodeFunctionData('approve', [
          odosRouter,
          ethers.constants.MaxUint256,
        ])

      const approvalToAgentToOdosROuter = {
        to: token.tokenAddress,
        value: 0,
        data: dataApproveToOdosROuter,
      }

      ApprovalsAgent.push(approvalToAgentToOdosROuter)
    } else {
      console.log('::API::ODOS::FOUND_ALLOWANCE_AGENT_ODOS')
    }

    // Check allowance Sender to OdosRouter
    // ----------------------------------------------------------------------------
    // ----------------------------------------------------------------------------
    // const allowanceSenderToOdosRouter = await tokenAContract?.allowance(
    //   sender,
    //   odosRouter
    // )

    // if (adjAmount.gt(allowanceSenderToOdosRouter)) {
    //   console.log(
    //     '::API::ODOS::BUILDSWAP:BATCHED MISSING_ALLOWANCE_SENDER_TO_ODOSROUTER'
    //   )

    //   const calldataApproveSenderToOdosRouter =
    //     tokenAContract.interface.encodeFunctionData('approve', [
    //       odosRouter,
    //       ethers.constants.MaxUint256,
    //     ])

    //   const approvalSenderToOdosRouter = {
    //     to: token.tokenAddress,
    //     value: 0,
    //     data: calldataApproveSenderToOdosRouter,
    //   }

    //   Approvals.push(approvalSenderToOdosRouter)
    // } else {
    //   console.log(
    //     '::API::ODOS::BUILDSWAP:BATCHED FOUND_ALLOWANCE_SENDER_TO_ODOSROUTER'
    //   )
    // }

    // Transfer tokens from Sender to Agent
    // ----------------------------------------------------------------------------
    // ----------------------------------------------------------------------------
    const dataTransferFromSenderToAgent =
      tokenAContract.interface.encodeFunctionData('transferFrom', [
        sender,
        agentAddress,
        token.amount,
      ])

    const transferFromSenderToAgent = {
      to: token.tokenAddress,
      value: 0,
      data: dataTransferFromSenderToAgent,
    }

    if (transferFromSenderToAgent)
      console.log('::API::ODOS::BUILD_TRANSFER_FROM_SENDER_AGENT')

    Calldatas.push(transferFromSenderToAgent)
  }

  // Build Odos Calldata
  // ----------------------------------------------------------------------------
  // ----------------------------------------------------------------------------
  const quoteRequestBody = {
    chainId: chainId,
    inputTokens: inputTokens,
    outputTokens: outputTokens,
    gasPrice: 80,
    userAddr: agentAddress,
    slippageLimitPercent: slippageLimitPercent,
    sourceBlacklist: [],
    sourceWhitelist: [],
    disableRFQs: disableRFQs,
    referralCode: 3844415834,
    compact: compact,
    pathVizImage: true,
  }

  console.log('::API::ODOS:: QUOTE_REQUEST_BODY', quoteRequestBody)

  const responseQuote = await fetch(ODOS_QUOTE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(quoteRequestBody),
  })

  let quote: { pathId: unknown }

  if (responseQuote.status === 200) {
    quote = await responseQuote.json()
    console.log(quote)
  } else {
    console.error('Error in Quote:', responseQuote)
    return
  }

  const assembleRequestBody = {
    userAddr: agentAddress,
    pathId: quote.pathId,
    simulate: false,
  }

  const responseAssemble = await fetch(ODOS_ASSEMBLE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(assembleRequestBody),
  })

  if (responseAssemble.status === 200) {
    const assembledTransaction = await responseAssemble.json()
    console.log(assembledTransaction)

    const tx = {
      to: assembledTransaction.transaction.to,
      value: Number(assembledTransaction.transaction.value),
      data: assembledTransaction.transaction.data,
    }

    Calldatas.push(tx)
  } else {
    console.error('Error in Transaction Assembly:', responseAssemble)
  }

  for (const token of outputTokens) {
    TokensReturn.push(token.tokenAddress)
  }

  console.log('::API::ODOS::Approvals', Approvals.length)
  console.log('::API::ODOS::ApprovalsAgent', ApprovalsAgent.length)
  console.log('::API::ODOS::Calldatas', Calldatas.length)
  console.log('::API::ODOS::TokensReturn', TokensReturn.length)

  return {
    Approvals,
    ApprovalsAgent,
    Calldatas,
    TokensReturn,
  }
}
