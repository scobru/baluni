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
import routerAbi from "../../abis/Router.json";
const pc = loadPrettyConsole();

/* export async function swap(dexWallet: DexWallet, pair: [string, string], reverse?: boolean) {
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
} */

export async function swap(
  dexWallet: DexWallet,
  token0: string,
  token1: string,
  reverse: boolean,
  protocol: string,
  chainId: string,
  amount: number,
) {
  const url = `http://localhost:3001/swap/${dexWallet.walletAddress}/${token0}/${token1}/${reverse}/${protocol}/${chainId}/${amount}`;

  const response = await fetch(url, {
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const provider = new ethers.providers.JsonRpcProvider(
    "https://polygon-mainnet.g.alchemy.com/v2/nPBTC9lNonD1KsZGmuXSRGfVh6O63x2_",
  );

  const routerAddress = INFRA[chainId].ROUTER;

  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY as string, provider);
  const data = await response.json().then(data => data);
  const router = new ethers.Contract(routerAddress, routerAbi, dexWallet.wallet);

  Promise.resolve(await data);

  const gasPrice = await provider.getFeeData();

  if (data.Approvals) {
    if (Object.keys(data.Approvals.UNIROUTER).length > 0) {
      const approveTxRouter = {
        to: data?.Approvals["UNIROUTER"]?.to,
        value: data?.Approvals["UNIROUTER"]?.value,
        data: data?.Approvals["UNIROUTER"]?.data,
        gasPrice: String(gasPrice?.gasPrice),
        gasLimit: 10000000,
      };

      const txApproveRouter = await wallet.sendTransaction(approveTxRouter);
      const resultApproveRouter = await waitForTx(provider, txApproveRouter?.hash);

      pc.log("Approve Router: ", resultApproveRouter);
    }

    if (Object.keys(data.Approvals.AGENT).length > 0) {
      const approveTxAgent = {
        to: data?.Approvals["AGENT"]?.to,
        value: data?.Approvals["AGENT"]?.value,
        data: data?.Approvals["AGENT"]?.data,
        gasPrice: String(gasPrice?.gasPrice),
        gasLimit: 10000000,
      };
      const txApproveAgent = await wallet.sendTransaction(approveTxAgent);
      const resultApproveAgent = await waitForTx(provider, txApproveAgent?.hash);

      pc.log("Approve Agent: ", resultApproveAgent);
    }
  }

  const transferFromSenderToAgent = {
    to: data?.Calldatas?.transferFromSenderToAgent?.to,
    value: data?.Calldatas?.transferFromSenderToAgent?.value,
    data: data?.Calldatas?.transferFromSenderToAgent?.data,
  };

  const approvalAgentToRouter = {
    to: data?.Calldatas?.approvalAgentToRouter?.to,
    value: data?.Calldatas?.approvalAgentToRouter?.value,
    data: data?.Calldatas?.approvalAgentToRouter?.data,
  };

  const swapAgentToRouter = {
    to: data?.Calldatas?.swapAgentToRouter?.to,
    value: data?.Calldatas?.swapAgentToRouter?.value,
    data: data?.Calldatas?.swapAgentToRouter?.data,
  };

  // simulate tx

  const TokensReturn = await data?.TokensReturn;
  console.log(TokensReturn);

  /* try {
    const simulationResult = await router?.callStatic?.execute(
      [transferFromSenderToAgent, approvalAgentToRouter, swapAgentToRouter],
      TokensReturn,
      {
        gasLimit: 10000000,
        gasPrice: String(gasPrice?.gasPrice),
      },
    );
    pc.log("Simulation successful:", simulationResult);
  } catch (error) {
    pc.error("Simulation failed:", error);
    return; // Abort if simulation fails
  }

  return; */

  const tx = await router?.execute(
    [transferFromSenderToAgent, approvalAgentToRouter, swapAgentToRouter],
    TokensReturn,
    {
      gasLimit: 10000000,
      gasPrice: String(gasPrice?.gasPrice),
    },
  );

  const broadcaster = await waitForTx(provider, await tx?.hash);
  pc.log("Batcher: ", broadcaster);
}
