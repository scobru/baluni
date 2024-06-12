import { BigNumber, Contract, Wallet, ethers } from 'ethers'
import { PROTOCOLS, INFRA } from '../../constants'
import env from 'dotenv'
import { getAdjAmount, route } from '../../utils/uniswap/bestQuote'
import { TradeType } from '@uniswap/sdk'
import erc20Abi from 'baluni-contracts/abis/common/ERC20.json'
import routerAbi from 'baluni-contracts/artifacts/contracts/orchestators/BaluniV1Router.sol/BaluniV1Router.json'
import factoryAbi from 'baluni-contracts/artifacts/contracts/orchestators/BaluniV1AgentFactory.sol/BaluniV1AgentFactory.json'
import registryAbi from 'baluni-contracts/artifacts/contracts/registry/BaluniV1Registry.sol/BaluniV1Registry.json'
import { waitForTx } from '../../../core/utils/web3/networkUtils'
import deployedContracts from 'baluni-contracts/deployments/deployedContracts.json'

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
  const walletAddress = await swaps[0].wallet.getAddress()

  const registry = new Contract(
    deployedContracts[swaps[0].chainId].BaluniV1Registry,
    registryAbi.abi,
    wallet
  )

  const infraRouter = await registry.getBaluniRouter()
  const agentFactory = await registry.getBaluniAgentFactory()
  const InfraRouterContract = new Contract(infraRouter, routerAbi.abi, wallet)
  const uniRouter = await registry.getUniswapRouter()

  const gasPrice = await wallet.provider.getGasPrice()
  const gasLimit = 8000000

  const Approvals = []
  const ApprovalsAgent = []
  const Calldatas = []
  let TokensReturn = []

  if (debug) console.log('::API::UNISWAP::ROUTER', infraRouter)
  if (debug) console.log('::API::UNISWAP::UNIROUTER', uniRouter)
  if (debug) console.log('::API::UNISWAP::WALLET ADDRESS', walletAddress)

  const tokensSet = new Set()
  let agentAddress = await InfraRouterContract?.getAgentAddress(walletAddress)

  if (agentAddress == ethers.constants.AddressZero) {
    if (debug) console.log('::API::CREATE AGENT')
    const factoryCtx = new Contract(agentFactory, factoryAbi.abi, wallet)

    if (debug) console.log('::API::CREATE AGENT SIMULATION')
    const txSimulate = await factoryCtx.callStatic.getOrCreateAgent(
      walletAddress,
      {
        gasPrice: gasPrice,
        gasLimit: gasLimit,
      }
    )

    if (!txSimulate) {
      return {
        Approvals,
        ApprovalsAgent,
        Calldatas,
        TokensReturn,
      }
    }
    if (debug) console.log('::API::CREATE AGENT EXECUTION')
    const tx = await factoryCtx.getOrCreateAgent(walletAddress, {
      gasPrice: gasPrice,
      gasLimit: gasLimit,
    })

    await waitForTx(wallet.provider, tx.hash, walletAddress)
    agentAddress = await InfraRouterContract?.getAgentAddress(walletAddress)
  }

  if (agentAddress == ethers.constants.AddressZero) {
    return {
      Approvals,
      ApprovalsAgent,
      Calldatas,
      TokensReturn,
    }
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
      walletAddress,
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
      if (debug) {
        console.log('::API::UNISWAP::FOUND_ALLOWANCE_SENDER_AGENT')
      }
    }

    // Encode Swap tx to Uni Router
    // ----------------------------------------------------------------------------
    // ----------------------------------------------------------------------------

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
      uniRouter
    )

    if (adjAmount.gt(allowanceAgentToUniversalRouter)) {
      if (debug)
        console.log('::API::UNISWAP::MISSING_ALLOWANCE_AGENT_UNIVERSAL_ROUTER')

      const calldataApproveAgentToRouter =
        tokenAContract.interface.encodeFunctionData('approve', [
          uniRouter,
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

    for (let i = 0; i < bestRoute.route.length; i++) {
      bestRoute.route[i].tokenPath.forEach(token =>
        tokensSet.add(token.address)
      )
    }

    // Transfer tokens from Sender to Agent
    // ----------------------------------------------------------------------------
    // ----------------------------------------------------------------------------

    const dataTransferFromSenderToAgent =
      tokenAContract.interface.encodeFunctionData('transferFrom', [
        walletAddress,
        agentAddress,
        adjAmount.add(BigNumber.from(100)),
      ])

    const transferFromSenderToAgent = {
      to: tokenAAddress,
      value: 0,
      data: dataTransferFromSenderToAgent,
    }

    if (transferFromSenderToAgent) {
      if (debug) console.log('::API::UNISWAP::BUILD_TRANSFER_FROM_SENDER_AGENT')

      Calldatas.push(transferFromSenderToAgent)
    }

    if (swapMultiAgentToRouter) {
      if (debug)
        console.log('::API::UNISWAP::BUILD_AGENT_EXACT_INPUT_TO_UNIROUTER')

      Calldatas.push(swapMultiAgentToRouter)
    }
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
