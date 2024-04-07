import { BigNumber, Contract, ethers } from 'ethers'
import { DexWallet } from '../../utils/web3/dexWallet'
import { formatEther, formatUnits } from 'ethers/lib/utils'
import { fetchPrices } from '../../utils/quote1Inch'
import { getTokenMetadata } from '../../utils/getTokenMetadata'
import { getTokenBalance } from '../../utils/getTokenBalance'
import { getTokenValue } from '../../utils/getTokenValue'
import { getRSI } from '../../features/ta/getRSI'
import { waitForTx } from '../../utils/web3/networkUtils'
import { INFRA } from 'baluni-api'
import {
  depositToYearnBatched,
  redeemFromYearnBatched,
  accuredYearnInterest,
  getVaultAsset,
} from 'baluni-api'
import routerAbi from 'baluni-api/dist/abis/infra/Router.json'
import erc20Abi from 'baluni-api/dist/abis/common/ERC20.json'
import * as config from './config.json'
import * as blocks from '../../utils/logBlocks'
import { TConfigReturn } from '../../types/config'

//import { YEARN_VAULTS } from '~~/dist/ui/config'
import { buildSwapOdos } from 'baluni-api/dist/odos'
//import { buildSwapOdos } from '../../../../baluni-api/dist/odos'

type TDeposit = {
  wallet: ethers.Wallet
  tokenAddr: string
  pool: string
  amount: BigNumber
  receiver: string
  chainId: string
}

type TRedeem = {
  wallet: ethers.Wallet
  pool: string
  amount: BigNumber
  receiver: string
  chainId: string
}

export async function getTokenValueEnhanced(
  tokenSymbol: string,
  token: string,
  tokenBalance: BigNumber,
  decimals: number,
  usdcAddress: string,
  yearnBalance?: BigNumber,
  interestAccrued?: BigNumber,
  chainId?: string
) {
  let effectiveBalance = tokenBalance

  if (config?.YEARN_ENABLED && yearnBalance) {
    effectiveBalance = yearnBalance.add(interestAccrued!).add(tokenBalance)
  }

  return tokenSymbol === 'USDC.E' || tokenSymbol === 'USDC'
    ? effectiveBalance.mul(1e12)
    : await getTokenValue(
        tokenSymbol,
        token,
        effectiveBalance,
        decimals,
        usdcAddress,
        chainId!
      )
}

export async function rebalancePortfolio(
  dexWallet: DexWallet,
  desiredTokens: string[],
  desiredAllocations: { [token: string]: number },
  usdcAddress: string,
  config: TConfigReturn
) {
  blocks.print2block()
  console.log('⚖️  Rebalance Portfolio\n')

  const gasLimit = 10000000
  const gas = await dexWallet?.walletProvider?.getGasPrice()
  const chainId = dexWallet.walletProvider.network.chainId
  const infraRouter = INFRA[chainId].ROUTER
  const router = new ethers.Contract(infraRouter, routerAbi, dexWallet.wallet)
  const tokenValues: { [token: string]: BigNumber } = {}

  let totalPortfolioValue = BigNumber.from(0)

  console.log(
    `🏦 Total Portfolio Value (in USDT) at Start: ${String(
      formatEther(totalPortfolioValue)
    )}`
  )

  // Calculate Total Portfolio Value
  // --------------------------------------------------------------------------------
  // --------------------------------------------------------------------------------

  blocks.print1block()

  console.log('📊 Calculate Total Portfolio Value')

  for (const token of desiredTokens) {
    let tokenValue
    const tokenContract = new ethers.Contract(token, erc20Abi, dexWallet.wallet)
    const tokenMetadata = await getTokenMetadata(
      token,
      dexWallet.walletProvider
    )

    const _tokenbalance = await getTokenBalance(
      dexWallet.walletProvider,
      dexWallet.walletAddress,
      token
    )
    const tokenBalance = _tokenbalance.balance
    const decimals = tokenMetadata.decimals
    const tokenSymbol = await tokenContract?.symbol()
    const yearnVaultAddress = config?.YEARN_VAULTS[tokenSymbol]

    if (yearnVaultAddress !== undefined) {
      const yearnContract = new ethers.Contract(
        yearnVaultAddress,
        erc20Abi,
        dexWallet.wallet
      )
      const yearnBalance = await yearnContract?.balanceOf(
        dexWallet.walletAddress
      )
      const interestAccrued = await accuredYearnInterest(
        yearnVaultAddress,
        dexWallet.walletAddress,
        chainId
      )

      tokenValue = await getTokenValueEnhanced(
        tokenSymbol,
        token,
        tokenBalance,
        decimals,
        usdcAddress,
        yearnBalance,
        interestAccrued,
        String(chainId)!
      )

      tokenValues[token] = tokenValue
      totalPortfolioValue = totalPortfolioValue.add(tokenValue)
    } else {
      tokenValue = await getTokenValue(
        tokenSymbol,
        token,
        tokenBalance,
        decimals,
        config?.USDC,
        String(chainId)
      )
      tokenValues[token] = tokenValue
      totalPortfolioValue = totalPortfolioValue.add(tokenValue)
    }
  }

  console.log(
    `🏦 Total Portfolio Value (in USDT): ", ${String(
      formatEther(totalPortfolioValue)
    )}`
  )

  const currentAllocations: { [token: string]: number } = {}
  const tokensToSell = []
  const tokensToBuy = []

  Object.keys(tokenValues).forEach(token => {
    currentAllocations[token] = tokenValues[token]
      .mul(10000)
      .div(totalPortfolioValue)
      .toNumber() // Store as percentage
  })

  // Rebalance
  // --------------------------------------------------------------------------------
  // --------------------------------------------------------------------------------
  blocks.print1block()

  console.log('📊 Rebalance Portfolio')

  for (const token of desiredTokens) {
    const currentAllocation = currentAllocations[token]
    const desiredAllocation = desiredAllocations[token]

    const difference = desiredAllocation - currentAllocation
    const tokenMetadata = await getTokenMetadata(
      token,
      dexWallet.walletProvider
    )

    const _tokenBalance = await getTokenBalance(
      dexWallet.walletProvider,
      dexWallet.walletAddress,
      token
    )
    const tokenSymbol: string = tokenMetadata.symbol as string

    const yearnVaultAddress = config?.YEARN_VAULTS[tokenSymbol]

    let tokenBalance = _tokenBalance.balance

    if (yearnVaultAddress !== undefined) {
      const yearnContract = new ethers.Contract(
        yearnVaultAddress,
        erc20Abi,
        dexWallet.wallet
      )
      const yearnBalance = await yearnContract?.balanceOf(
        dexWallet.walletAddress
      )
      tokenBalance = _tokenBalance.balance.add(yearnBalance)
    }
    const valueToRebalance = totalPortfolioValue
      .mul(BigNumber.from(Math.abs(difference)))
      .div(10000)

    console.group(`🪙  Token: ${token}`)
    console.log(`📊 Current Allocation: ${currentAllocation}%`)
    console.log(`💰 Difference: ${difference}%`)
    console.log(`💲 Value (USD): ${formatEther(tokenValues[token])}`)
    console.log(
      `⚖️  Value to Rebalance (USD): ${formatEther(valueToRebalance)}`
    )
    console.log(`👛 Balance: ${formatEther(tokenBalance)} ${tokenSymbol}`)
    console.groupEnd()

    if (difference < 0 && Math.abs(difference) > config?.LIMIT) {
      const tokenMetadata = await getTokenMetadata(
        token,
        dexWallet?.walletProvider
      )
      const decimals = tokenMetadata.decimals

      const _token = {
        address: token,
        decimals: decimals,
      }

      const tokenPriceInUSDT: number = await fetchPrices(
        _token,
        String(chainId)
      ) // Ensure this returns a value

      const pricePerToken = ethers.utils.parseUnits(
        tokenPriceInUSDT!.toString(),
        'ether'
      )
      const tokenAmountToSell = valueToRebalance
        .mul(BigNumber.from(10).pow(decimals))
        .div(pricePerToken)

      tokensToSell.push({ token, amount: tokenAmountToSell })
    } else if (difference > 0 && Math.abs(difference) > config?.LIMIT) {
      tokensToBuy.push({ token, amount: valueToRebalance.div(1e12) })
    }

    blocks.printline()
  }

  // Quote ODOS
  const quoteRequestBody = {
    chainId: Number(chainId), // Replace with desired chainId
    inputTokens: [] as { tokenAddress: string; amount: string }[],
    outputTokens: [] as { tokenAddress: string; proportion: number }[],
    userAddr: '0x',
    slippageLimitPercent: Number(config.SLIPPAGE / 1000), // set your slippage limit percentage (1 = 1%),

    referralCode: 3844415834, // referral code (recommended)
    disableRFQs: true,
    compact: true,
  }

  // Sell Tokens
  // --------------------------------------------------------------------------------
  // --------------------------------------------------------------------------------
  blocks.print1block()
  console.log('🔄 Sell Tokens')

  const yearnRedeems = []

  for (const { token, amount: amountWei } of tokensToSell) {
    try {
      const tokenContract = new Contract(token, erc20Abi, dexWallet.wallet)
      const tokenSymbol = await tokenContract.symbol()
      const tokenDecimal = await tokenContract.decimals()
      const pool = config?.YEARN_VAULTS[tokenSymbol]

      console.log(
        `🔴 Selling ${formatUnits(
          amountWei,
          tokenDecimal
        )} worth of ${tokenSymbol}`
      )

      // Redeem from Yearn Vaults
      if (pool !== undefined && pool !== config?.YEARN_VAULTS.USDC) {
        const balance = await getTokenBalance(
          dexWallet.walletProvider,
          dexWallet.walletAddress,
          token
        )

        const yearnCtx = new ethers.Contract(pool, erc20Abi, dexWallet.wallet)
        const yearnCtxBal = await yearnCtx?.balanceOf(dexWallet.walletAddress)

        if (
          Number(amountWei) < Number(await balance.balance) &&
          Number(yearnCtxBal) >= Number(amountWei)
        ) {
          console.log('Redeem from Yearn')
          const data: TRedeem = {
            wallet: dexWallet.wallet,
            pool: pool,
            amount: amountWei,
            receiver: dexWallet.walletAddress,
            chainId: String(chainId),
          }

          yearnRedeems.push(data)
        } else if (Number(yearnCtxBal) > Number(0)) {
          console.log('Redeem from Yearn')
          const data: TRedeem = {
            wallet: dexWallet.wallet,
            pool: pool,
            amount: yearnCtxBal,
            receiver: dexWallet.walletAddress,
            chainId: String(chainId),
          }

          yearnRedeems.push(data)
        }
      }

      const [rsiResult, stochasticRSIResult] = await getRSI(tokenSymbol, config)
      const balance = (
        await getTokenBalance(
          dexWallet.walletProvider,
          dexWallet.walletAddress,
          token
        )
      ).balance

      // Sell token if RSI and StochRSI are overbought
      if (
        BigNumber.from(amountWei).lt(balance) ||
        BigNumber.from(amountWei).eq(balance)
      ) {
        if (
          stochasticRSIResult.stochRSI > config?.STOCKRSI_OVERBOUGHT &&
          rsiResult.rsiVal > (config?.RSI_OVERBOUGHT as number) &&
          config?.TECNICAL_ANALYSIS
        ) {
          const tokenSymbol = await tokenContract.symbol()

          console.log('Condition met for selling', tokenSymbol)

          if (!quoteRequestBody.inputTokens) {
            quoteRequestBody.inputTokens = []
          }

          quoteRequestBody.inputTokens.push({
            tokenAddress: token,
            amount: String(amountWei),
          })

          console.log('Input Token Added')
        } else if (!config?.TECNICAL_ANALYSIS) {
          if (!quoteRequestBody.inputTokens) {
            quoteRequestBody.inputTokens = []
          }

          quoteRequestBody.inputTokens.push({
            amount: String(amountWei),
            tokenAddress: token,
          })

          console.log('Input Token Added')
        }
      }
      blocks.printline()
    } catch (e) {
      console.log(e)
    }
  }

  // Buy Tokens
  // --------------------------------------------------------------------------------
  // --------------------------------------------------------------------------------
  blocks.print1block()
  console.log('🔄 Buy Tokens')

  const existTokenToSell = quoteRequestBody.inputTokens.length > 0
  const poolAddress = config?.YEARN_VAULTS.USDC

  const poolCtx = new ethers.Contract(poolAddress, erc20Abi, dexWallet.wallet)
  const yBalUSDC = await poolCtx?.balanceOf(dexWallet.walletAddress)

  const balUSD: BigNumber = await (
    await getTokenBalance(
      dexWallet.walletProvider,
      dexWallet.walletAddress,
      config?.USDC
    )
  )?.balance

  let totalAmountWei = BigNumber.from(0)

  if (existTokenToSell) {
    tokensToBuy.forEach(token => {
      totalAmountWei = totalAmountWei.add(token.amount)
    })

    quoteRequestBody.inputTokens.map(token => {
      if (token.tokenAddress === usdcAddress) {
        token.amount = String(totalAmountWei)
      }
    })

    let totalProportion = 0

    for (const { token, amount: amountWei } of tokensToBuy) {
      console.log(`🟩 Buying ${Number(amountWei) / 1e6} USDC worth of ${token}`)

      const tokenCtx = new Contract(token, erc20Abi, dexWallet.wallet)
      const tokenSym = await tokenCtx.symbol()

      const [rsiResult, stochasticRSIResult] = await getRSI(tokenSym, config)

      const isTechnicalAnalysisConditionMet =
        stochasticRSIResult.stochRSI < config?.STOCKRSI_OVERSOLD &&
        rsiResult.rsiVal < config?.RSI_OVERSOLD

      if (isTechnicalAnalysisConditionMet || !config?.TECNICAL_ANALYSIS) {
        const tokenSym = await tokenCtx.symbol()
        console.log('Condition met for buying', tokenSym)
        quoteRequestBody.outputTokens.push({
          tokenAddress: token,
          proportion: Number(amountWei) / Number(totalAmountWei),
        })
        totalProportion += Number(amountWei) / Number(totalAmountWei)
      } else {
        console.warn('⚠️ Waiting for StochRSI overSold')
      }

      blocks.printline()
    }

    /* if (totalProportion != 1) {
      console.error(
        '⚠️ Total proportion is greater than 1 or less than 1',
        totalProportion
      )
      return
    } */
  } else {
    console.log('No Tokens To Sell')
  }

  console.log('🟩 USDC Balance: ', formatUnits(balUSD, 6))
  console.log('🟩 Yearn USDC Balance: ', formatUnits(yBalUSDC, 6))

  // Redeem USDC from Yearn Vaults
  if (tokensToBuy.length > 0 && yBalUSDC.gt(0)) {
    console.log('Redeem from Yearn Vaults')
    const data: TRedeem = {
      wallet: dexWallet.wallet,
      pool: poolAddress,
      amount: yBalUSDC,
      receiver: dexWallet.walletAddress,
      chainId: String(chainId),
    }
    yearnRedeems.push(data)
  }

  // Redeem from Yearn Vaults
  // --------------------------------------------------------------------------------
  // --------------------------------------------------------------------------------
  blocks.print1block()
  console.log('📡 Yearn Redeem Data')
  try {
    const data = await redeemFromYearnBatched(yearnRedeems)
    if (data?.Approvals.length > 0) {
      console.log('📡 Approvals')
      const approvals = data.Approvals
      for (const approval of approvals) {
        approval.gasLimit = gasLimit
        approval.gasPrice = gas

        const approvalTx = await dexWallet.wallet.sendTransaction(approval)
        const broadcaster = await waitForTx(
          dexWallet.walletProvider,
          approvalTx?.hash,
          dexWallet.walletAddress
        )

        console.log(`📡 Approval broadcasted: ${broadcaster}`)
      }
    }

    if (data?.Calldatas.length > 0) {
      console.log('📡 Calldatas')
      const simulate = await router.callStatic.execute(
        data?.Calldatas,
        data?.TokensReturn,
        {
          gasLimit: gasLimit,
          gasPrice: gas,
        }
      )

      console.log(`📡  Simulation successful:: ${simulate}`)

      if (!simulate) return console.log('📡 Simulation failed')
      const tx = await router.execute(data?.Calldatas, data?.TokensReturn, {
        gasLimit: gasLimit,
        gasPrice: gas,
      })
      const broadcaster = await waitForTx(
        dexWallet.walletProvider,
        tx?.hash,
        dexWallet.walletAddress
      )
      console.log(`📡  Tx broadcasted:: ${broadcaster}`)
    }
  } catch (e) {
    console.log(e)
  }

  try {
    if (
      quoteRequestBody.inputTokens.length === 0 ||
      quoteRequestBody.outputTokens.length === 0
    ) {
      console.log('📡 No tokens to sell or buy')
    } else {
      quoteRequestBody.userAddr = dexWallet.walletAddress

      const data = await buildSwapOdos(
        dexWallet.wallet,
        dexWallet.walletAddress,
        String(chainId),
        quoteRequestBody.inputTokens,
        quoteRequestBody.outputTokens,
        Number(quoteRequestBody.slippageLimitPercent),
        Number(quoteRequestBody.referralCode),
        Boolean(quoteRequestBody.disableRFQs),
        Boolean(quoteRequestBody.compact)
      )

      if (data?.Approvals.length > 0) {
        console.log('📡 Approvals')

        const approvals = data.Approvals

        for (const approval of approvals) {
          approval.gasLimit = gasLimit
          approval.gasPrice = gas

          const approvalTx = await dexWallet.wallet.sendTransaction(approval)
          const broadcaster = await waitForTx(
            dexWallet.walletProvider,
            approvalTx?.hash,
            dexWallet.walletAddress
          )

          console.log(`📡 Approval broadcasted: ${broadcaster}`)
        }
      }

      if (data?.Calldatas.length > 0) {
        console.log('📡 Calldatas')

        const simulate = await router.callStatic.execute(
          data?.Calldatas,
          data?.TokensReturn,
          {
            gasLimit: gasLimit,
            gasPrice: gas,
          }
        )

        if ((await simulate) === false)
          return console.log('📡 Simulation failed')

        console.log(`📡  Simulation successful:: ${simulate}`)

        if (!simulate) return console.log('📡 Simulation failed')

        const calldata = router.interface.encodeFunctionData('execute', [
          data.Calldatas,
          data.TokensReturn,
        ])

        const tx = {
          to: router.address,
          value: 0,
          data: calldata,
          gasLimit: gasLimit,
          gasPrice: gas,
        }

        const executeTx = await dexWallet.wallet.sendTransaction(tx)
        const broadcaster = await waitForTx(
          dexWallet.walletProvider,
          executeTx?.hash,
          dexWallet.walletAddress
        )
        console.log(`📡 Tx broadcasted:: ${broadcaster}`)
      }
    }
  } catch (e) {
    console.log(e)
  }

  // Deposit to Yearn Vaults
  // --------------------------------------------------------------------------------
  // --------------------------------------------------------------------------------

  console.log('⚖️ Yearn Deposit Data\n')
  blocks.print1block()

  const yearnDeposits = []

  for (const vault of Object.values(config?.YEARN_VAULTS)) {
    const vaultAsset = await getVaultAsset(String(vault), chainId)
    const assetContract = new ethers.Contract(
      vaultAsset,
      erc20Abi,
      dexWallet.wallet
    )

    const balance = await assetContract.balanceOf(dexWallet.walletAddress)

    if (balance.gt(0)) {
      if (tokensToBuy.length == 0 || tokensToSell.length == 0) {
        console.log(
          `Deposit to Yearn Vaults Amount: ${Number(
            balance
          )}, Vault:  ${vaultAsset}`
        )
        const data: TDeposit = {
          wallet: dexWallet.wallet,
          tokenAddr: vaultAsset,
          pool: String(vault),
          amount: balance,
          receiver: dexWallet.walletAddress,
          chainId: String(config?.SELECTED_CHAINID),
        }
        yearnDeposits.push(data)
      }
    }
  }

  try {
    const data = await depositToYearnBatched(yearnDeposits)

    if (data?.Approvals.length > 0) {
      console.log('📡 Approvals')

      const approvals = data.Approvals

      for (const approval of approvals) {
        approval.gasLimit = gasLimit
        approval.gasPrice = gas

        const approvalTx = await dexWallet.wallet.sendTransaction(approval)
        const broadcaster = await waitForTx(
          dexWallet.walletProvider,
          approvalTx?.hash,
          dexWallet.walletAddress
        )

        console.log(`📡 Approval broadcasted: ${broadcaster}`)
      }
    }

    if (data?.Calldatas.length > 0) {
      console.log('📡 Calldatas')

      const simulate = await router.callStatic.execute(
        data?.Calldatas,
        data?.TokensReturn,
        {
          gasLimit: gasLimit,
          gasPrice: gas,
        }
      )

      if ((await simulate) === false) return console.log('📡 Simulation failed')

      console.log(`📡  Simulation successful:: ${simulate}`)

      if (!simulate) return console.log('📡 Simulation failed')

      const calldata = router.interface.encodeFunctionData('execute', [
        data.Calldatas,
        data.TokensReturn,
      ])

      const tx = {
        to: router.address,
        value: 0,
        data: calldata,
        gasLimit: gasLimit,
        gasPrice: gas,
      }

      const executeTx = await dexWallet.wallet.sendTransaction(tx)
      const broadcaster = await waitForTx(
        dexWallet.walletProvider,
        executeTx?.hash,
        dexWallet.walletAddress
      )
      console.log(`📡 Tx broadcasted:: ${broadcaster}`)
    }
  } catch (e) {
    console.log(e)
  }

  blocks.print1starry()
  console.log('✔️ Rebalance completed.')
}
