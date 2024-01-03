import { BigNumber, Contract } from "ethers";
import { SLIPPAGE } from "../config";
import { loadPrettyConsole } from "../utils/prettyConsole";

const prettyConsole = loadPrettyConsole();
export async function getAmountOut(
  tokenA: string,
  tokenB: string,
  poolFee: Number,
  swapAmount: BigNumber,
  quoterContract: Contract
) {
  try {
    let slippageTolerance = SLIPPAGE;

    let expectedAmountB = await quoterContract.callStatic.quoteExactInputSingle(
      tokenA,
      tokenB,
      poolFee,
      swapAmount.toString(),
      0
    );

    prettyConsole.log(
      `Amount A: ${swapAmount.toString()}`,
      `Expected amount B: ${expectedAmountB.toString()}`
    );

    let minimumAmountB = expectedAmountB
      .mul(10000 - slippageTolerance)
      .div(10000);

    return minimumAmountB;
  } catch (e) {
    return false;
  }
}

export async function getPoolFee(
  tokenAAddress: string,
  tokenBAddress: string,
  swapAmount: BigNumber,
  quoterContract: Contract
): Promise<number> {
  const poolFees = [500, 3000, 10000];
  let poolFee = 0;
  for (const _poolFee of poolFees) {
    let poolExist = await getAmountOut(
      tokenAAddress,
      tokenBAddress,
      _poolFee,
      swapAmount,
      quoterContract
    );

    if (poolExist) {
      poolFee = _poolFee;
    }
  }

  return poolFee;
}
