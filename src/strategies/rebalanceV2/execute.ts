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
  getVaultAsset,
} from 'baluni-api'
import routerAbi from 'baluni-api/dist/abis/infra/Router.json'
import erc20Abi from 'baluni-api/dist/abis/common/ERC20.json'
import yearnVaultAbi from 'baluni-api/dist/abis/yearn/YearnVault.json'
import * as blocks from '../../utils/logBlocks'
import { TConfigReturn } from '../../types/config'
import { BuildSwapOdosParams } from '../../types/odos'
import { TDeposit, TRedeem } from '../../types/yearn'
import { buildSwapOdos } from 'baluni-api/dist/odos'

// import { buildSwapOdos } from '../../../../baluni-api/dist/odos'
// import {
//   depositToYearnBatched,
//   redeemFromYearnBatched,
//   getVaultAsset,
// } from '../../../../baluni-api/dist'
// import { INFRA } from '../../../../baluni-api/dist/constants'

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

    const currentValue = await getTokenValue(
      tokenSymbol,
      token,
      tokenBalance,
      decimals,
      config?.USDC,
      String(chainId)
    )

    if (yearnVaultAddress !== undefined) {
      const yearnContract = new ethers.Contract(
        yearnVaultAddress,
        yearnVaultAbi,
        dexWallet.wallet
      )

      const yearnBalance = await yearnContract?.balanceOf(
        dexWallet.walletAddress
      )

      const maxRedeem = await yearnContract?.previewRedeem(yearnBalance)
      const tokenValueYearn = await getTokenValue(
        tokenSymbol,
        token,
        maxRedeem,
        decimals,
        usdcAddress,
        String(chainId)
      )

      tokenValues[token] = currentValue.add(tokenValueYearn)
      totalPortfolioValue = totalPortfolioValue.add(tokenValues[token])
    } else {
      tokenValues[token] = currentValue
      totalPortfolioValue = totalPortfolioValue.add(currentValue)
    }
  }

  console.log(
    `🏦 Total Portfolio Value (in USDT): ", ${String(
      formatEther(totalPortfolioValue)
    )}`
  )

  const currentAllocations: { [token: string]: number } = {}
  let tokensToSell = []
  let tokensToBuy = []

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
    const tokenDecimals = tokenMetadata.decimals
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
        yearnVaultAbi,
        dexWallet.wallet
      )
      const yearnBalance = await yearnContract?.balanceOf(
        dexWallet.walletAddress
      )
      const redeemAmount = await yearnContract?.previewRedeem(yearnBalance)
      tokenBalance = tokenBalance.add(redeemAmount)
    }
    const valueToRebalance = totalPortfolioValue
      .mul(BigNumber.from(Math.abs(difference)))
      .div(10000)

    const formattedBalance = formatUnits(tokenBalance, tokenDecimals)

    console.group(`🪙  Token: ${token}`)
    console.log(`📊 Current Allocation: ${currentAllocation}%`)
    console.log(`💰 Difference: ${difference}%`)
    console.log(`💲 Value (USD): ${formatEther(tokenValues[token])}`)
    console.log(
      `⚖️  Value to Rebalance (USD): ${formatEther(valueToRebalance)}`
    )
    console.log(`👛 Balance: ${formattedBalance} ${tokenSymbol}`)
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
      console.log(
        `🔴 Amount To Sell ${formatEther(tokenAmountToSell)} ${tokenSymbol}`
      )
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
      const vault = config?.YEARN_VAULTS[tokenSymbol]
      console.log(
        `🔴 Selling ${formatUnits(
          amountWei,
          tokenDecimal
        )} worth of ${tokenSymbol}`
      )
      const tokenBalance = await getTokenBalance(
        dexWallet.walletProvider,
        dexWallet.walletAddress,
        token
      )
      const balance = tokenBalance.balance

      const [rsiResult, stochasticRSIResult] = await getRSI(tokenSymbol, config)
      if (vault !== undefined && Number(await balance) < Number(amountWei)) {
        const yearnCtx = new ethers.Contract(vault, erc20Abi, dexWallet.wallet)
        const yearnCtxBal = await yearnCtx?.balanceOf(dexWallet.walletAddress)

        if (Number(yearnCtxBal) >= Number(amountWei)) {
          console.log('Redeem from Yearn')
          const data: TRedeem = {
            wallet: dexWallet.wallet,
            pool: vault,
            amount: amountWei,
            receiver: dexWallet.walletAddress,
            chainId: String(chainId),
          }
          yearnRedeems.push(data)
        } else if (Number(yearnCtxBal) > 0) {
          console.log('Redeem from Yearn')
          const data: TRedeem = {
            wallet: dexWallet.wallet,
            pool: vault,
            amount: yearnCtxBal,
            receiver: dexWallet.walletAddress,
            chainId: String(chainId),
          }
          yearnRedeems.push(data)
        }
      }

      // Sell token if RSI and StochRSI are overbought
      if (
        BigNumber.from(amountWei).lt(balance) ||
        BigNumber.from(amountWei).eq(balance)
      ) {
        if (
          stochasticRSIResult.stochRSI > config?.STOCKRSI_OVERBOUGHT &&
          rsiResult.rsiVal > config?.RSI_OVERBOUGHT &&
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
      } else if (BigNumber.from(amountWei).gt(balance) && balance.gt(0)) {
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
            amount: String(balance),
          })
          console.log('Input Token Added')
        } else if (!config?.TECNICAL_ANALYSIS) {
          if (!quoteRequestBody.inputTokens) {
            quoteRequestBody.inputTokens = []
          }

          quoteRequestBody.inputTokens.push({
            amount: String(balance),
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

  // const poolAddress = config?.YEARN_VAULTS.USDC
  // const poolCtx = new ethers.Contract(poolAddress, erc20Abi, dexWallet.wallet)
  // const yBalUSDC = await poolCtx?.balanceOf(dexWallet.walletAddress)
  // const balUSD: BigNumber = await (
  //   await getTokenBalance(
  //     dexWallet.walletProvider,
  //     dexWallet.walletAddress,
  //     config?.USDC
  //   )
  // )?.balance

  let totalAmountWei = BigNumber.from(0)
  const existTokenToSell = quoteRequestBody.inputTokens.length > 0
  const existTokenToSellAndBuy =
    tokensToBuy.length > 0 && tokensToSell.length > 0

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

    if (totalProportion != 1) {
      console.error(
        '⚠️ Total proportion is greater than 1 or less than 1',
        totalProportion
      )
      tokensToBuy = []
    }
  } else {
    console.log('No Tokens To Sell')
  }

  // Redeem from Yearn Vaults
  // --------------------------------------------------------------------------------
  // --------------------------------------------------------------------------------

  blocks.print1block()
  console.log('📡 Yearn Redeem Data')
  try {
    if (existTokenToSellAndBuy) {
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
    }
  } catch (e) {
    console.log(e)
  }

  // Build Swap Odos
  // --------------------------------------------------------------------------------
  // --------------------------------------------------------------------------------

  try {
    if (
      quoteRequestBody.inputTokens.length === 0 ||
      quoteRequestBody.outputTokens.length === 0
    ) {
      console.log('📡 No tokens to sell or buy')
    } else {
      quoteRequestBody.userAddr = dexWallet.walletAddress

      const params: BuildSwapOdosParams = {
        wallet: dexWallet.wallet,
        sender: dexWallet.walletAddress,
        chainId: String(chainId),
        inputTokens: quoteRequestBody.inputTokens,
        outputTokens: quoteRequestBody.outputTokens,
        slippageLimitPercent: Number(quoteRequestBody.slippageLimitPercent),
        referralCode: Number(quoteRequestBody.referralCode),
        disableRFQs: Boolean(quoteRequestBody.disableRFQs),
        compact: Boolean(quoteRequestBody.compact),
      }

      const data = await buildSwapOdos(
        params.wallet,
        params.sender,
        params.chainId,
        params.inputTokens,
        params.outputTokens,
        params.slippageLimitPercent,
        params.referralCode,
        params.disableRFQs,
        params.compact
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
      if (tokensToBuy.length == 0 && tokensToSell.length == 0) {
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
