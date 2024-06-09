import { BigNumberish, BigNumber, Contract, Wallet, ethers } from 'ethers'
import erc20Abi from 'baluni-contracts/abis/common/ERC20.json'
import routerAbi from 'baluni-contracts/artifacts/contracts/orchestators/BaluniV1Router.sol/BaluniV1Router.json'
import factoryAbi from 'baluni-contracts/artifacts/contracts/orchestators/BaluniV1AgentFactory.sol/BaluniV1AgentFactory.json'
import registryAbi from 'baluni-contracts/artifacts/contracts/registry/BaluniV1Registry.sol/BaluniV1Registry.json'
import quoterAbi from '../../abis/uniswap/Quoter.json'
import swapRouterAbi from '../../abis/uniswap/SwapRouter.json'

import { PROTOCOLS, INFRA } from '../../constants'
import env from 'dotenv'
import {
  getAdjAmount,
  getBestQuoteForSwapPath,
} from '../../utils/uniswap/bestQuote'

env.config()

export async function buildSwap(
  wallet: Wallet,
  address: string,
  token0: string,
  token1: string,
  reverse: boolean,
  protocol: string,
  chainId: string,
  amount: string,
  slippage: number
) {
  console.log('BUILD SWAP')

  const quoter = String(PROTOCOLS[chainId][protocol].QUOTER)
  const factory = String(PROTOCOLS[chainId][protocol].FACTORY)
  const uniRouter = String(PROTOCOLS[chainId][protocol].ROUTER)
  const swapRouterContract = new Contract(uniRouter, swapRouterAbi, wallet)

  const registry = new Contract(
    INFRA[chainId].REGISTRY,
    registryAbi.abi,
    wallet
  )
  const infraRouter = await registry.getBaluniRouter()

  const InfraRouterContract = new Contract(infraRouter, routerAbi.abi, wallet)
  const agentAddress = await InfraRouterContract.getAgentAddress(address)
  const tokenAAddress = reverse == true ? token1 : token0
  const tokenBAddress = reverse == true ? token0 : token1
  const tokenAContract = new Contract(tokenAAddress, erc20Abi, wallet)
  const tokenADecimals = await tokenAContract.decimals()

  const tokenABalance = await tokenAContract.balanceOf(address)

  console.log(
    '::API::UNISWAP::BUILDSWAP TOKEN_A_BALANCE ',
    Number(tokenABalance)
  )

  console.log('::API::UNISWAP::BUILDSWAP TOKEN_A_ADDRESS ', tokenAAddress)

  // const tokenBContract = new Contract(tokenBAddress, erc20Abi, provider);
  // const tokenBDecimals = await tokenBContract.decimals();
  // const gasLimit: Number = 30000000;
  // const gasPrice: BigNumberish = await wallet.provider.getGasPrice();
  // const gas: BigNumberish = gasPrice;

  let Approvals = []
  let Calldatas = []
  let adjAmount: any = ethers.BigNumber.from(0)

  console.log(
    '::API::UNISWAP::BUILDSWAP TOKEN_DECIMAL ',
    Number(tokenADecimals)
  )

  if (tokenADecimals == 0) {
    throw new Error('Invalid Token Decimals')
  }
  adjAmount = getAdjAmount(amount, tokenADecimals) as BigNumberish

  console.log('::API::UNISWAP::BUILDSWAP AMOUNT ', Number(amount))

  console.log('::API::UNISWAP::BUILDSWAP ADJ_AMOUNT ', Number(adjAmount))

  if (tokenABalance.lt(adjAmount)) {
    console.log('::API::UNISWAP:: BUILDSWAP INSUFFICIENT_BALANCE')
  } else {
    if (adjAmount == 0) {
      throw new Error('Invalid Token Decimals')
    }

    const quoterContract = new Contract(quoter, quoterAbi, wallet)
    const factoryContract = new Contract(factory, factoryAbi.abi, wallet)

    // const quote = await quotePair(
    //   tokenAAddress,
    //   tokenBAddress,
    //   Number(chainId)
    // );

    const allowanceAgent: BigNumber = await tokenAContract?.allowance(
      address,
      agentAddress
    )

    const allowanceAgentToRouter: BigNumber = await tokenAContract?.allowance(
      agentAddress,
      uniRouter
    )

    const slippageTolerance = slippage

    console.log(
      '::API::UNISWAP::BUILDSWAP ALLOWANCE_AGENT_SENDER_AMOUNT',
      Number(allowanceAgent)
    )
    console.log(
      '::API::UNISWAP::BUILDSWAP ALLOWANCE_AGENT_UNIROUTER_AMOUNT',
      Number(allowanceAgentToRouter)
    )
    console.log('::API::UNISWAP::BUILDSWAP ROUTER_ADDRESS', infraRouter)
    console.log('::API::UNISWAP::BUILDSWAP UNI_ROUTER_ADDRESS', uniRouter)
    console.log('::API::UNISWAP::BUILDSWAP AGENT_ADDRESS', agentAddress)

    // Allowance for Sender to Agent
    // ----------------------------------------------------------------------------
    // ----------------------------------------------------------------------------

    if (allowanceAgent.lt(adjAmount)) {
      console.log(
        '::API::UNISWAP::BUILDSWAP MISSING_ALLOWANCE_SENDER_FOR_AGENT '
      )

      const dataApproveToAgent = tokenAContract.interface.encodeFunctionData(
        'approve',
        [agentAddress, ethers.constants.MaxUint256]
      )
      const tx = {
        to: tokenAAddress,
        value: 0,
        data: dataApproveToAgent,
      }

      Approvals.push(tx)
    } else {
      console.log('::API::UNISWAP::BUILDSWAP FOUND_SENDER_ALLOWANCE_FOR_AGENT')
    }

    // Allowance for Agent to Univ3
    // ----------------------------------------------------------------------------
    // ----------------------------------------------------------------------------

    if (allowanceAgentToRouter.lt(adjAmount)) {
      console.log(
        '::API::UNISWAP::BUILDSWAP MISSING_AGENT_ALLOWANCE_FOR_UNIROUTER '
      )

      const calldataApproveAgentToRouter =
        tokenAContract.interface.encodeFunctionData('approve', [
          uniRouter,
          ethers.constants.MaxUint256,
        ])
      const tx = {
        to: tokenAAddress,
        value: 0,
        data: calldataApproveAgentToRouter,
      }

      Calldatas.push(tx)
    } else {
      console.log(
        '::API::UNISWAP::BUILDSWAP FOUND_AGENT_ALLOWANCE_FOR_UNIROUTER'
      )
    }

    // Transfer tokens from Sender to Agent
    // ----------------------------------------------------------------------------
    // ----------------------------------------------------------------------------
    const dataTransferFromSenderToAgent =
      tokenAContract.interface.encodeFunctionData('transferFrom', [
        address,
        agentAddress,
        adjAmount,
      ])

    const tx = {
      to: tokenAAddress,
      value: 0,
      data: dataTransferFromSenderToAgent,
    }

    if (tx)
      console.log(
        '::API::UNISWAP::BUILDSWAP BUILD_TRANSFER_FROM_SENDER_TO_AGENT'
      )

    Calldatas.push(tx)

    // Encode Swap tx to Uni Router
    // ----------------------------------------------------------------------------
    // ----------------------------------------------------------------------------

    const bestQuote = await getBestQuoteForSwapPath(
      factoryContract,
      quoterContract,
      tokenAAddress,
      tokenBAddress,
      adjAmount,
      slippageTolerance,
      chainId
    )

    console.log('::API:: BEST QUOTE FOUND!', bestQuote)

    let swapDeadline = Math.floor(Date.now() / 1000 + 60 * 60) // 1 hour from now
    let path

    if (
      bestQuote.amountOut !== BigNumber.from(0) &&
      bestQuote.poolFees.length != 1
    ) {
      path = ethers.utils.solidityPack(
        ['address', 'uint24', 'address', 'uint24', 'address'],
        [
          bestQuote.path[0],
          bestQuote.poolFees[0],
          bestQuote.path[1],
          bestQuote.poolFees[1],
          bestQuote.path[2],
        ]
      )
    } else if (bestQuote.amountOut !== BigNumber.from(0)) {
      path = ethers.utils.solidityPack(
        ['address', 'uint24', 'address'],
        [bestQuote.path[0], bestQuote.poolFees[0], bestQuote.path[1]]
      )
    }

    let swapTxInputs = [path, agentAddress, swapDeadline, adjAmount, 0]

    const calldataSwapAgentToRouter =
      swapRouterContract.interface.encodeFunctionData('exactInputSingle', [
        swapTxInputs,
      ])

    const tx2 = {
      to: uniRouter,
      value: 0,
      data: calldataSwapAgentToRouter,
    }

    if (tx2)
      console.log(
        '::API::UNISWAP::BUILDSWAP BUILD_AGENT_EXACT_INPUT_TO_UNIROUTER'
      )

    Calldatas.push(tx2)
  }

  const TokensReturn = [tokenBAddress]

  console.log('::API::UNISWAP::BUILDSWAP Approvals', Approvals.length)
  console.log('::API::UNISWAP::BUILDSWAP Calldatas', Calldatas.length)
  console.log('::API::UNISWAP::BUILDSWAP TokensReturn', TokensReturn.length)

  return {
    Approvals,
    Calldatas,
    TokensReturn,
  }
}
