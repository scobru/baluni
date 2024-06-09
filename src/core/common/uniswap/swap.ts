import { ethers, Contract } from 'ethers'
import { DexWallet } from '../../utils/web3/dexWallet'
import { waitForTx } from '../../utils/web3/networkUtils'
import { NETWORKS, INFRA, BASEURL } from '../../../api/constants'
import { buildSwap } from '../../../api/uniswap/actions/buildSwap'
import registryAbi from 'baluni-contracts/artifacts/contracts/registry/BaluniV1Registry.sol/BaluniV1Registry.json'
import infraRouterAbi from 'baluni-contracts/artifacts/contracts/orchestators/BaluniV1Router.sol/BaluniV1Router.json'

export async function swap(
  dexWallet: DexWallet,
  token0: string,
  token1: string,
  reverse: boolean,
  protocol: string,
  chainId: number,
  amount: string,
  slippage: number
) {
  const provider = new ethers.providers.JsonRpcProvider(NETWORKS[chainId])
  const registry = new Contract(
    INFRA[chainId].REGISTRY,
    registryAbi.abi,
    dexWallet.wallet
  )

  const routerAddress = await registry.getBaluniRouter()
  const wallet = dexWallet.wallet
  const router = new ethers.Contract(
    routerAddress,
    infraRouterAbi.abi,
    dexWallet.wallet
  )

  // METHOD 2
  //-------------------------------------------------------------------------------------
  async function fetchTokenInfo(url: string) {
    const response = await fetch(url, { method: 'GET' })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}, url: ${url}`)
    }

    return await response.json()
  }

  const token0AddressUrl = `${BASEURL}/${chainId}/${protocol}/tokens/${token0}`
  const token0Info = await fetchTokenInfo(token0AddressUrl)

  const token1AddressUrl = `${BASEURL}/${chainId}/${protocol}/tokens/${token1}`
  const token1Info = await fetchTokenInfo(token1AddressUrl)

  const data = await buildSwap(
    dexWallet?.wallet,
    dexWallet?.walletAddress,
    String(token0Info.address),
    String(token1Info.address),
    Boolean(reverse),
    protocol,
    String(chainId),
    String(amount),
    slippage
  )

  await Promise.resolve(data?.Approvals).then(async approvals => {
    if (approvals.length > 0) {
      console.log('Sending approvals')
      for (const approval of approvals) {
        if (approval && Object.keys(approval).length > 0) {
          try {
            const txApprove = await wallet.sendTransaction(approval)
            const resultApprove = await waitForTx(
              provider,
              txApprove?.hash,
              dexWallet.walletAddress
            )
            console.log('Approval Transaction Result: ', resultApprove)
          } catch (error) {
            console.error('Approval Transaction Error: ', error)
          }
        }
      }
    } else {
      console.log('No approvals required')
    }
  })

  const calldatasArray = await Promise.all(data?.Calldatas)
  const TokensReturn = data?.TokensReturn

  if (calldatasArray?.length === 0) return console.error('No calldatas found')

  try {
    console.log('Sending calldatasArray')
    const simulationResult: unknown = await router?.callStatic?.execute(
      calldatasArray,
      TokensReturn
    )
    console.log('Simulation successful:', await simulationResult)

    if (simulationResult === false) {
      console.error('Simulation failed')
      return
    }

    const tx = await router.execute(calldatasArray, TokensReturn)
    const txReceipt = await waitForTx(
      provider,
      await tx?.hash,
      dexWallet.walletAddress
    )
    console.log('Transaction executed, receipt:', txReceipt)
  } catch (error) {
    console.error('Simulation failed:', error)
    return
  }
}
