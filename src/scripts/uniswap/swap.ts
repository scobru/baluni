import { BigNumber, Contract, ethers } from "ethers";
import { DexWallet } from "../../utils/dexWallet";
import { callContractMethod } from "../../utils/contractUtils";
import { waitForTx } from "../../utils/networkUtils";
import erc20Abi from "../../abis/common/ERC20.json";
import swapRouterAbi from "../../abis/uniswap/SwapRouter.json";
import quoterAbi from "../../abis/uniswap/Quoter.json";
import barcherAbi from "../../abis/Batcher.json";
import { formatEther, parseEther } from "ethers/lib/utils";
import { loadPrettyConsole } from "../../utils/prettyConsole";
import { updateConfig } from "../../config/updateConfig";
import { INFRA } from "../../api/constants";

const prettyConsole = loadPrettyConsole();

export async function swap(dexWallet: DexWallet, pair: [string, string], reverse?: boolean) {
  const config = await updateConfig();
  const { wallet, walletAddress, walletBalance, providerGasPrice, walletProvider } = dexWallet;

  const chainId = walletProvider.network.chainId;

  prettyConsole.log(walletAddress + ":", walletBalance.toBigInt());

  const tokenAAddress = reverse ? pair[1] : pair[0];
  const tokenBAddress = reverse ? pair[0] : pair[1];
  const tokenAContract = new Contract(tokenAAddress, erc20Abi, wallet);
  const tokenBContract = new Contract(tokenBAddress, erc20Abi, wallet);

  const tokenABalance: BigNumber = await tokenAContract.balanceOf(walletAddress);

  const tokenBBalance: BigNumber = await tokenBContract.balanceOf(walletAddress);

  const tokenAName = await tokenAContract.symbol();
  const tokenBName = await tokenBContract.symbol();

  prettyConsole.log("Token A", tokenABalance.toBigInt(), "Token B:", tokenBBalance.toBigInt());

  const swapRouterAddress = config?.ROUTER as string; // polygon
  const swapRouterContract = new Contract(swapRouterAddress, swapRouterAbi, wallet);

  prettyConsole.log("Provider gas price:", providerGasPrice.toBigInt());
  const gasPrice: BigNumber = providerGasPrice.mul(12).div(10);
  prettyConsole.log("  Actual gas price:", gasPrice.toBigInt());

  const allowance: BigNumber = await tokenAContract.allowance(walletAddress, swapRouterAddress);
  prettyConsole.log("Token A spenditure allowance:", allowance.toBigInt());

  if (allowance.lt(tokenABalance)) {
    const approvalResult = await callContractMethod(
      tokenAContract,
      "approve",
      [swapRouterAddress, tokenABalance],
      walletProvider,
      gasPrice,
    );
    const broadcasted = await waitForTx(wallet.provider, approvalResult.hash);
    if (!broadcasted) {
      throw new Error(`TX broadcast timeout for ${approvalResult.hash}`);
    } else {
      prettyConsole.success(`Spending of ${tokenABalance.toBigInt()} approved.`);
    }
  }

  prettyConsole.log(`Swap ${tokenAName} for ${tokenBName}`);

  const swapDeadline = Math.floor(Date.now() / 1000 + 60 * 60);
  const slippageTolerance = config?.SLIPPAGE as number;

  const quoterContract = new Contract(config?.QUOTER as string, quoterAbi, wallet);
  const expectedAmountB = await quoterContract.callStatic.quoteExactInputSingle(
    tokenAAddress,
    tokenBAddress,
    3000,
    tokenABalance.toString(),
    0,
  );

  prettyConsole.log(
    "Amount A: ",
    formatEther(tokenABalance),
    "Expected amount B:",
    formatEther(expectedAmountB.toString()),
  );

  const minimumAmountB = expectedAmountB.mul(10000 - slippageTolerance).div(10000);
  const swapTxInputs = [
    tokenAAddress,
    tokenBAddress,
    BigNumber.from(3000),
    walletAddress,
    BigNumber.from(swapDeadline),
    tokenABalance,
    minimumAmountB, // BigNumber.from(0),
    BigNumber.from(0),
  ];

  const swapTxResponse = await callContractMethod(
    swapRouterContract,
    "exactInputSingle",
    [swapTxInputs],
    walletProvider,
    gasPrice,
  );

  return swapTxResponse;
}

/* export async function swap(
  dexWallet: DexWallet,
  pair: [string, string],
  reverse: boolean,
  chainId: string,
  protocol: string,
  amount: number,
) {
  const url =
    "http://localhost:3001/swap/0x8aA5F726d9F868a21a8bd748E2f1E43bA31eb670/0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174/0xb33EaAd8d922B1083446DC23f610c2567fB5180f/true/uni-v3/137/0";

  const response = await fetch(url, {
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const provider = new ethers.providers.JsonRpcProvider(
    "https://polygon-mainnet.g.alchemy.com/v2/nPBTC9lNonD1KsZGmuXSRGfVh6O63x2_",
  );

  const batcherAddress = INFRA[chainId].BATCHER;

  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY as string, provider);
  const data = await response.json().then(data => data);
  const batcher = new ethers.Contract(batcherAddress, barcherAbi, wallet);

  Promise.resolve(await data);

  const gasPrice = await provider.getFeeData();

  // Approve To Router
  const calldataWithGas = {
    to: data?.approvalSenderToRouter?.to,
    value: data?.approvalSenderToRouter?.value,
    data: data?.approvalSenderToRouter?.data,
    gasPrice: String(gasPrice?.gasPrice),
    gasLimit: 10000000,
  };

  const calldataWithGasUni = {
    to: data?.approvalSenderToUni?.to,
    value: data?.approvalSenderToUni?.value,
    data: data?.approvalSenderToUni?.data,
    gasPrice: String(gasPrice?.gasPrice),
    gasLimit: 10000000,
  };

  const txApprove = await wallet.sendTransaction(calldataWithGas);
  const result = await waitForTx(provider, txApprove?.hash);

  console.log(calldataWithGas);
  console.log("Approve: ", result);

  const txApproveUni = await wallet.sendTransaction(calldataWithGasUni);
  const resultUni = await waitForTx(provider, txApproveUni?.hash);

  console.log(calldataWithGasUni);
  console.log("Approve Uni: ", resultUni);

  const calldataWithGasTransferFrom = {
    to: data?.transferFromSenderToRouter?.to,
    value: data?.transferFromSenderToRouter?.value,
    data: data?.transferFromSenderToRouter?.data,
  };

  const calldataApproveRouterToUni = {
    to: data?.approvalRouterToUni?.to,
    value: data?.approvalRouterToUni?.value,
    data: data?.approvalRouterToUni?.data,
  };

  const calldataSwapRouterToUni = {
    to: data?.swapRouterToUni?.to,
    value: data?.swapRouterToUni?.value,
    data: data?.swapRouterToUni?.data,
  };

  const tx = await batcher?.multicall(
    [calldataWithGasTransferFrom, calldataApproveRouterToUni, calldataSwapRouterToUni],
    {
      gasLimit: 10000000,
      gasPrice: String(gasPrice?.gasPrice),
    },
  );

  const broadcaster = await waitForTx(provider, await tx?.hash);
  console.log("Batcher: ", broadcaster);
}
 */
