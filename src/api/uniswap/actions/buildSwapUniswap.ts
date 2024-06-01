import { BigNumber, Contract, Wallet, ethers } from 'ethers'
import erc20Abi from '../../abis/common/ERC20.json'
import { PROTOCOLS, INFRA } from '../../constants'
import env from 'dotenv'
import { getAdjAmount, route } from '../../utils/uniswap/bestQuote'
import { TradeType } from '@uniswap/sdk'
import routerAbi from '../../abis/infra/Router.json'
import factoryAbi from '../../abis/infra/Factory.json'

env.config()

const debug = true

export async function buildSwapUniswap(
  swaps: Array<{
    wallet: Wallet
    address: string
    token0: string
    token1: string
    reverse: boolean
    protocol: string
    chainId: string
    amount: string
    slippage: number
  }>
) {
  console.log('Building Batch Swap tx')

  const wallet = swaps[0].wallet
  const walletAddress = swaps[0].address

  const protocol = PROTOCOLS[swaps[0].chainId][swaps[0].protocol]
  const infraRouter = String(INFRA[swaps[0].chainId].ROUTER)

  const InfraRouterContract = new Contract(infraRouter, routerAbi, wallet)
  const uniRouter = String(protocol.ROUTER)
  const agentFactory = String(INFRA[swaps[0].chainId].FACTORY)

  const Approvals = []
  const ApprovalsAgent = []
  const Calldatas = []

  let TokensReturn = []

  if (debug) console.log('::API::UNISWAP::ROUTER', infraRouter)
  if (debug) console.log('::API::UNISWAP::UNIROUTER', uniRouter)

  const tokensSet = new Set()
  let agentAddress = await InfraRouterContract?.getAgentAddress(
    swaps[0].address
  )

  if (agentAddress === ethers.constants.AddressZero) {
    const factoryCtx = new Contract(agentFactory, factoryAbi, wallet)
    const tx = await factoryCtx.getOrCreateAgent(wallet.address)
    tx.wait()
    agentAddress = await InfraRouterContract?.getAgentAddress(swaps[0].address)
  }

  for (const swap of swaps) {
    if (debug)
      console.log('::API: -----------------------------------------------')
    if (debug) console.log('::API::UNISWAP::AGENT', agentAddress)

    const tokenAAddress = swap.reverse ? swap.token1 : swap.token0
    const tokenBAddress = swap.reverse ? swap.token0 : swap.token1

    const tokenAContract = new Contract(tokenAAddress, erc20Abi, wallet)
    const tokenABalance = await tokenAContract?.balanceOf(swap.address)
    const tokenBContract = new Contract(tokenBAddress, erc20Abi, wallet)

    if (debug) console.log('::API::UNISWAP::TOKEN_A', tokenAAddress)
    if (debug) console.log('::API::UNISWAP::TOKEN_B', tokenBAddress)
    if (debug) console.log('::API::UNISWAP::BALANCE', Number(tokenABalance))

    const allowanceAgent = await tokenAContract?.allowance(
      swap.address,
      agentAddress
    )

    const tokenADecimals = await tokenAContract.decimals()
    const tokenBDecimals = await tokenBContract.decimals()

    let adjAmount: BigNumber = ethers.BigNumber.from(0)

    if (debug) console.log('::API::UNISWAP::AMOUNT:', String(swap.amount))

    adjAmount = getAdjAmount(swap.amount, tokenADecimals)

    if (debug) console.log('::API::UNISWAP::ADJ_AMOUNT:', String(adjAmount))

    // Allowance for Sender to Agnet
    // ----------------------------------------------------------------------------
    // ----------------------------------------------------------------------------

    if (adjAmount.gt(allowanceAgent)) {
      if (debug) console.log('::API::UNISWAP::MISSING_ALLOWANCE_SENDER_AGENT')

      const dataApproveToAgent = tokenAContract?.interface.encodeFunctionData(
        'approve',
        [agentAddress, ethers.constants.MaxUint256]
      )

      const approvalToAgent = {
        to: tokenAAddress,
        value: 0,
        data: dataApproveToAgent,
      }

      Approvals.push(approvalToAgent)
    } else {
      if (debug) console.log('::API::UNISWAP::FOUND_ALLOWANCE_SENDER_AGENT')
    }

    // Check allowance Router to UniRouter
    // ----------------------------------------------------------------------------
    // ----------------------------------------------------------------------------

    // const allowanceAgentToUniRouter = await tokenAContract?.allowance(
    //   agentAddress,
    //   uniRouter
    // )

    // if (adjAmount.gt(allowanceAgentToUniRouter)) {
    //   if (debug) console.log('::API::UNISWAP::MISSING_ALLOWANCE_AGENT_UNISWAP')

    //   const calldataApproveAgentToRouter =
    //     tokenAContract.interface.encodeFunctionData('approve', [
    //       uniRouter,
    //       ethers.constants.MaxUint256,
    //     ])

    //   const approvalAgentToRouter = {
    //     to: tokenAAddress,
    //     value: 0,
    //     data: calldataApproveAgentToRouter,
    //   }

    //   ApprovalsAgent.push(approvalAgentToRouter)
    // } else {
    //   if (debug) console.log('::API::UNISWAP::FOUND_ALLOWANCE_AGENT_UNISWAP')
    // }

    // Transfer tokens from Sender to Agent
    // ----------------------------------------------------------------------------
    // ----------------------------------------------------------------------------

    const dataTransferFromSenderToAgent =
      tokenAContract.interface.encodeFunctionData('transferFrom', [
        swap.address,
        agentAddress,
        adjAmount,
      ])

    const transferFromSenderToAgent = {
      to: tokenAAddress,
      value: 0,
      data: dataTransferFromSenderToAgent,
    }

    if (transferFromSenderToAgent)
      if (debug) console.log('::API::UNISWAP::BUILD_TRANSFER_FROM_SENDER_AGENT')

    Calldatas.push(transferFromSenderToAgent)

    // Encode Swap tx to Uni Router
    // ----------------------------------------------------------------------------
    // ----------------------------------------------------------------------------
    // const quote = await quotePair(
    //   tokenAAddress,
    //   tokenBAddress,
    //   Number(swap.chainId)
    // );
    // const slippageTolerance = swap.slippage;

    const currency = {
      address: tokenBAddress,
      decimals: tokenBDecimals,
      symbol: await tokenBContract.symbol(),
      name: await tokenBContract.name(),
    }

    const currencyAmount = {
      address: tokenAAddress,
      decimals: tokenADecimals,
      symbol: await tokenAContract.symbol(),
      name: await tokenAContract.name(),
    }

    const bestRoute = await route({
      chainId: Number(137),
      recipient: agentAddress,
      amount: adjAmount,
      tradeType: TradeType.EXACT_INPUT,
      currencyAmount: currencyAmount,
      currency: currency,
      slippage: swaps[0].slippage,
    })

    const swapMultiAgentToRouter = {
      to: bestRoute.methodParameters.to,
      value: bestRoute.methodParameters.value,
      data: bestRoute.methodParameters.calldata,
    }

    const allowanceAgentToUniversalRouter = await tokenAContract?.allowance(
      agentAddress,
      bestRoute.methodParameters.to
    )

    if (adjAmount.gt(allowanceAgentToUniversalRouter)) {
      if (debug)
        console.log('::API::UNISWAP::MISSING_ALLOWANCE_AGENT_UNIVERSAL_ROUTER')

      const calldataApproveAgentToRouter =
        tokenAContract.interface.encodeFunctionData('approve', [
          bestRoute.methodParameters.to,
          ethers.constants.MaxUint256,
        ])

      const approvalAgentToRouter = {
        to: tokenAAddress,
        value: 0,
        data: calldataApproveAgentToRouter,
      }

      Calldatas.push(approvalAgentToRouter)
    } else {
      if (debug)
        console.log('::API::UNISWAP::FOUND_ALLOWANCE_AGENT_UNIVERSAL_ROUTER')
    }

    const allowanceSenderToUniversalRouter = await tokenAContract?.allowance(
      walletAddress,
      bestRoute.methodParameters.to
    )

    if (adjAmount.gt(allowanceSenderToUniversalRouter)) {
      if (debug)
        console.log('::API::UNISWAP::MISSING_ALLOWANCE_SENDER-UNIVERSAL_ROUTER')

      const calldataApproveAgentToRouter =
        tokenAContract.interface.encodeFunctionData('approve', [
          bestRoute.methodParameters.to,
          ethers.constants.MaxUint256,
        ])

      const approvalAgentToRouter = {
        to: tokenAAddress,
        value: 0,
        data: calldataApproveAgentToRouter,
      }

      Approvals.push(approvalAgentToRouter)
    } else {
      if (debug)
        console.log('::API::UNISWAP::FOUND_ALLOWANCE_AGENT_UNIVERSAL_ROUTER')
    }

    for (let i = 0; i < bestRoute.route.length; i++) {
      bestRoute.route[i].tokenPath.forEach(token =>
        tokensSet.add(token.address)
      )
    }

    if (swapMultiAgentToRouter)
      if (debug)
        console.log('::API::UNISWAP::BUILD_AGENT_EXACT_INPUT_TO_UNIROUTER')

    Calldatas.push(swapMultiAgentToRouter)
  }

  TokensReturn = Array.from(tokensSet)

  if (debug) console.log('::API::UNISWAP::Approvals', Approvals.length)
  if (debug)
    console.log('::API::UNISWAP::ApprovalsAgent', ApprovalsAgent.length)
  if (debug) console.log('::API::UNISWAP::Calldatas', Calldatas.length)
  if (debug) console.log('::API::UNISWAP::TokensReturn', TokensReturn.length)

  return {
    Approvals,
    ApprovalsAgent,
    Calldatas,
    TokensReturn,
  }
}
