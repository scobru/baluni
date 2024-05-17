import { BigNumber, Contract } from 'ethers'
import { DexWallet } from '../../utils/web3/dexWallet'
import { swap } from '../../common/uniswap/swap'
import { formatEther } from 'ethers/lib/utils'
import { loadPrettyConsole } from '../../utils/prettyConsole'
import { getTokenAddressUniV3 } from '../../utils/getTokenAddress'
import erc20Abi from '../../../api/abis/common/ERC20.json'

const pc = loadPrettyConsole()

export async function invest(
  dexWallet: DexWallet,
  allocations: { [token: string]: number },
  usdtAddress: string,
  desiredTokens: string[],
  sellAll: boolean,
  buyAmount: string,
  protocol: string,
  chainId: any,
  slippage: number
) {
  const tokenContract = new Contract(usdtAddress, erc20Abi, dexWallet.wallet)
  let usdBalance: BigNumber = await tokenContract.balanceOf(
    dexWallet.wallet.address
  )

  let totalAllocation = 0
  for (const token of desiredTokens) {
    totalAllocation += allocations[token]
  }

  if (totalAllocation !== 10000) {
    // Assuming allocations are in basis points (10000 = 100%)
    throw new Error('Total allocation must sum up to 100%')
  }

  if (sellAll) {
    for (const _token of desiredTokens) {
      const token = await getTokenAddressUniV3(_token, chainId)
      const tokenContract = new Contract(token, erc20Abi, dexWallet.wallet)
      const tokenBalance: BigNumber = await tokenContract.balanceOf(
        dexWallet.wallet.address
      )
      pc.log('Balance for', token, 'is', formatEther(tokenBalance))
      if (tokenBalance > BigNumber.from(0)) {
        pc.log('Selling', token)
        const balanceString =
          token.decimals == 6 ? tokenBalance.div(1e6) : tokenBalance.div(1e18)
        await swap(
          dexWallet,
          token,
          'USDC.E',
          false,
          protocol,
          chainId,
          String(balanceString),
          slippage
        )
        await new Promise(resolve => setTimeout(resolve, 10000))
      } else {
        pc.log('No Balance for', token)
      }
    }
  }

  for (const _token of desiredTokens) {
    const token = await getTokenAddressUniV3(_token, chainId)
    if (buyAmount) {
      usdBalance = BigNumber.from(buyAmount).mul(1e6)
    }

    const allocationPercentage = BigNumber.from(allocations[token])
    const tokenAmount = usdBalance.mul(allocationPercentage).div(10000)

    // Swap USDT for the current token based on its allocation
    if (!tokenAmount.isZero()) {
      //await swapCustom(dexWallet, [token, usdtAddress], true, tokenAmount);
      const balanceString = tokenAmount.div(1e6)

      await swap(
        dexWallet,
        token,
        'USDC.E',
        true,
        protocol,
        chainId,
        String(balanceString),
        slippage
      )
      await new Promise(resolve => setTimeout(resolve, 10000))
    }
  }

  pc.log('Investment distributed according to allocations.')
}
