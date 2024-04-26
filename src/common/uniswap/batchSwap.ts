import infraRouterAbi from 'baluni-api/dist/abis/infra/Router.json'
import { ethers } from 'ethers'
import { DexWallet } from '../../utils/web3/dexWallet'
import { waitForTx } from '../../utils/web3/networkUtils'
import { NETWORKS, INFRA, BASEURL } from 'baluni-api'
import { buildSwapUniswap } from 'baluni-api'
//import { buildSwapUniswap } from '../../../../baluni-api/dist/uniswap/actions/buildSwapUniswap'

export async function batchSwap(
  swaps: Array<{
    dexWallet: DexWallet
    token0: string
    token1: string
    reverse: boolean
    protocol: string
    chainId: number
    amount: string
    slippage: number
  }>
) {
  console.log('Execute Batch Swap')

  const provider = new ethers.providers.JsonRpcProvider(
    NETWORKS[swaps[0].chainId]
  )

  const gas = await provider?.getGasPrice()

  const gasLimit = 8000000

  const wallet = swaps[0].dexWallet.wallet

  const routerAddress = INFRA[swaps[0].chainId].ROUTER

  const router = new ethers.Contract(routerAddress, infraRouterAbi, wallet)

  const allApprovals: unknown[] = []

  const allCalldatas: unknown[] = []

  const allTokensReturn: unknown[] = []

  async function fetchTokenInfo(url: string) {
    const response = await fetch(url, { method: 'GET' })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}, url: ${url}`)
    }

    return await response.json()
  }

  await Promise.all(
    swaps.map(async swap => {
      const token0AddressUrl = `${BASEURL}/${swap.chainId}/${swap.protocol}/tokens/${swap.token0}`

      const token0Info = await fetchTokenInfo(token0AddressUrl)

      const token1AddressUrl = `${BASEURL}/${swap.chainId}/${swap.protocol}/tokens/${swap.token1}`

      const token1Info = await fetchTokenInfo(token1AddressUrl)

      swap.token0 = String(token0Info.address)
      swap.token1 = String(token1Info.address)
    })
  )

  // const url = `${BASEURL}/swap/${swap.dexWallet.walletAddress}/${swap.token0}/${swap.token1}/${swap.reverse}/${swap.protocol}/${swap.chainId}/${swap.amount}`;
  // const url = `http://localhost:3001/swap/${swap.dexWallet.walletAddress}/${swap.token0}/${swap.token1}/${swap.reverse}/${swap.protocol}/${swap.chainId}/${swap.amount}`;
  // const response = await fetch(url, { method: "POST" });
  // if (!response.ok) {
  //   throw new Error(`HTTP error! status: ${response.status}`);
  // }
  // const data = await response.json();

  const data = await buildSwapUniswap(
    swaps.map(swap => ({
      wallet: swap.dexWallet.wallet,
      address: swap.dexWallet.walletAddress,
      token0: swap.token0,
      token1: swap.token1,
      reverse: Boolean(swap.reverse),
      protocol: swap.protocol,
      chainId: String(swap.chainId),
      amount: String(swap.amount),
      slippage: swap.slippage,
    }))
  )

  if (data.TokensReturn && data.TokensReturn.length > 0) {
    allTokensReturn.push(...data.TokensReturn)
  }

  if (data.Approvals && data.Approvals.length > 0) {
    allApprovals.push(...data.Approvals)
  }

  if (data.Calldatas && data.Calldatas.length > 0) {
    allCalldatas.push(...data.Calldatas)
  }

  if (allApprovals.length != 0) {
    for (const approval of allApprovals) {
      const approveTx = {
        to: (approval as { to: string }).to,
        value: (approval as { value: number }).value,
        data: (approval as { data: any }).data,
        gasLimit: gasLimit,
        gasPrice: gas,
      }

      try {
        console.log('Sending approvals')
        const tx = await wallet.sendTransaction(approveTx)
        const broadcaster = await waitForTx(
          swaps[0].dexWallet.walletProvider,
          tx.hash,
          swaps[0].dexWallet.walletAddress
        )
        console.log('Approval Transaction Result: ', broadcaster)
      } catch (error) {
        console.error('Approval Transaction Error: ', error)
      }
    }
  } else {
    console.log('No approvals required')
  }

  if (allCalldatas.length != 0) {
    try {
      const simulationResult = await router.callStatic.execute(
        allCalldatas,
        allTokensReturn,
        {
          gasLimit: gasLimit,
          gasPrice: gas,
        }
      )
      console.log('Simulation successful:', simulationResult)

      if (!simulationResult) return console.error('Simulation failed')

      const tx = await router.execute(allCalldatas, allTokensReturn, {
        gasLimit: gasLimit,
        gasPrice: gas,
      })

      const broadcaster = await waitForTx(
        wallet.provider,
        tx.hash,
        swaps[0].dexWallet.walletAddress
      )

      console.log('Transaction executed', broadcaster)
    } catch (error) {
      console.error('Simulation failed:', error)
      return
    }
  }
}
