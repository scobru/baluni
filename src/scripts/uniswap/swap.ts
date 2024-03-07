import infraRouterAbi from "baluni-api/dist/abis/infra/Router.json";
import { ethers } from "ethers";
import { DexWallet } from "../../utils/dexWallet";
import { waitForTx } from "../../utils/networkUtils";
import { loadPrettyConsole } from "../../utils/prettyConsole";
const pc = loadPrettyConsole();
import { INFRA, BASEURL, swapUniV3 } from "baluni-api";

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
  // const url = `${BASEURL}/swap/${dexWallet.walletAddress}/${token0}/${token1}/${reverse}/${protocol}/${chainId}/${amount}`;

  // const response = await fetch(url, {
  //   method: "POST",
  // });

  // if (!response.ok) {
  //   throw new Error(`HTTP error! status: ${response.status}`);
  // }

  const data = await swapUniV3(
    dexWallet?.walletAddress,
    token0,
    token1,
    String(reverse),
    protocol,
    Number(chainId),
    amount,
  );

  const provider = new ethers.providers.JsonRpcProvider(
    "https://polygon-mainnet.g.alchemy.com/v2/nPBTC9lNonD1KsZGmuXSRGfVh6O63x2_",
  );

  const routerAddress = INFRA[chainId].ROUTER;

  const wallet = dexWallet.wallet;
  //const data = await response.json().then(data => data);
  const router = new ethers.Contract(routerAddress, infraRouterAbi, dexWallet.wallet);

  Promise.resolve(await data);

  const gasPrice = await provider.getFeeData();

  if (data?.Approvals && data?.Approvals.length > 0) {
    for (const approval of data.Approvals) {
      if (approval && Object.keys(approval).length > 0) {
        const approveTx = {
          to: approval.to,
          value: approval.value,
          data: approval.data,
          gasPrice: String(gasPrice?.gasPrice),
          gasLimit: 10000000,
        };

        try {
          // Invio della transazione di approvazione
          const txApprove = await wallet.sendTransaction(approveTx);
          const resultApprove = await waitForTx(provider, txApprove?.hash);
          pc.log("Approval Transaction Result: ", resultApprove);
        } catch (error) {
          pc.error("Approval Transaction Error: ", error);
        }
      }
    }
  }

  // Supponendo che data.Calldatas sia ora un array di oggetti
  const calldatasArray = data?.Calldatas.map((calldata: { to: any; value: any; data: any }) => ({
    to: calldata.to,
    value: calldata.value,
    data: calldata.data,
  }));

  const TokensReturn = await data?.TokensReturn;

  pc.log(TokensReturn);
  console.log(calldatasArray);

  try {
    // Simulazione della transazione utilizzando callStatic per eseguire senza consumare gas
    const simulationResult = await router?.callStatic?.execute(calldatasArray, TokensReturn, {
      gasLimit: 10000000,
      gasPrice: String(gasPrice?.gasPrice),
    });
    pc.log("Simulation successful:", simulationResult);
  } catch (error) {
    console.error("Simulation failed:", error);
    return; // Interrompe l'esecuzione se la simulazione fallisce
  }

  // Esecuzione effettiva della transazione dopo una simulazione di successo
  const tx = await router?.execute(calldatasArray, TokensReturn, {
    gasLimit: 10000000,
    gasPrice: String(gasPrice?.gasPrice),
  });

  // Attesa della ricevuta della transazione
  const txReceipt = await waitForTx(provider, await tx?.hash);
  pc.log("Transaction executed, receipt:", txReceipt);
}

export async function batchSwap(
  swaps: Array<{
    dexWallet: DexWallet;
    token0: string;
    token1: string;
    reverse: boolean;
    protocol: string;
    chainId: string;
    amount: number;
  }>,
) {
  const provider = swaps[0].dexWallet.wallet.provider;
  const gasPrice = await provider.getFeeData();
  const wallet = swaps[0].dexWallet.wallet;
  const routerAddress = INFRA[swaps[0].chainId].ROUTER;
  const router = new ethers.Contract(routerAddress, infraRouterAbi, wallet);

  let allApprovals = [];
  let allCalldatas = [];
  let allTokensReturn = [];

  for (const swap of swaps) {
    const url = `${BASEURL}/swap/${swap.dexWallet.walletAddress}/${swap.token0}/${swap.token1}/${swap.reverse}/${swap.protocol}/${swap.chainId}/${swap.amount}`;

    const response = await fetch(url, { method: "POST" });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    if (data.Approvals && data.Approvals.length > 0) {
      allApprovals.push(...data.Approvals);
    }

    if (data.Calldatas && data.Calldatas.length > 0) {
      allCalldatas.push(...data.Calldatas);
    }

    if (data.TokensReturn && data.TokensReturn.length > 0) {
      allTokensReturn.push(...data.TokensReturn);
    }
  }

  // Gestione delle approvazioni (potrebbe essere necessario consolidare le approvazioni per lo stesso token)
  for (const approval of allApprovals) {
    const approveTx = {
      to: approval.to,
      value: approval.value,
      data: approval.data,
      gasPrice: String(gasPrice?.gasPrice),
      gasLimit: 10000000,
    };

    try {
      const txApprove = await wallet.sendTransaction(approveTx);
      await txApprove.wait();
      console.log("Approval Transaction Result: ", txApprove.hash);
    } catch (error) {
      console.error("Approval Transaction Error: ", error);
    }
  }

  // Simulazione della transazione utilizzando callStatic per eseguire senza consumare gas
  try {
    const simulationResult = await router.callStatic.execute(allCalldatas, allTokensReturn, {
      gasLimit: 10000000,
      gasPrice: String(gasPrice?.gasPrice),
    });
    console.log("Simulation successful:", simulationResult);
  } catch (error) {
    console.error("Simulation failed:", error);
    return; // Interrompe l'esecuzione se la simulazione fallisce
  }

  // Esecuzione effettiva della transazione dopo una simulazione di successo
  const tx = await router.execute(allCalldatas, allTokensReturn, {
    gasLimit: 10000000,
    gasPrice: String(gasPrice?.gasPrice),
  });

  // Attesa della ricevuta della transazione
  const txReceipt = await tx.wait();
  console.log("Transaction executed, receipt:", txReceipt.transactionHash);
}
