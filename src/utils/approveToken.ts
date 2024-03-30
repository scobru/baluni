import {Contract, BigNumber, ethers} from 'ethers';
import {callContractMethod} from './web3/contractUtils';
import {DexWallet} from './web3/dexWallet';
import {waitForTx} from './web3/networkUtils';

export async function approveToken(
  tokenContract: Contract,
  swapAmount: BigNumber,
  to: string,
  gasPrice: BigNumber,
  dexWallet: DexWallet,
  maxApproval: boolean
) {
  let allowance: BigNumber = await tokenContract.allowance(
    dexWallet.walletAddress,
    to
  );

  if (allowance.lt(swapAmount)) {
    console.log(
      'Approving spending of',
      swapAmount.toString(),
      'tokens' + ' to ' + to + '... '
    );
    const approveAmount = maxApproval
      ? ethers.constants.MaxUint256
      : swapAmount;
    const approvalResult = await callContractMethod(
      tokenContract,
      'approve',
      [to, approveAmount],
      dexWallet.walletProvider,
      gasPrice
    );
    const broadcasted = await waitForTx(
      dexWallet.wallet.provider,
      approvalResult.hash,
      dexWallet.wallet.address
    );
    if (!broadcasted) {
      throw new Error(`TX broadcast timeout for ${approvalResult.hash}`);
    } else {
      console.log(`Spending of ${swapAmount.toString()} approved.`);
    }
  } else {
    console.log('No need to approve');
  }
}
