import infraRouterAbi from "baluni-api/dist/abis/infra/Router.json";
import { ethers } from "ethers";
import { DexWallet } from "../../utils/dexWallet";
import { waitForTx } from "../../utils/networkUtils";
import { loadPrettyConsole } from "../../utils/prettyConsole";
const pc = loadPrettyConsole();
import /* buildSwap, buildBatchSwap */ "baluni-api";

import {
  /* batchSwapUniV3, swapUniV3, */ buildSwap,
  buildBatchSwap,
  NETWORKS,
  INFRA,
  BASEURL,
} from "../../../../baluni-api/dist";

export async function swap(
  dexWallet: DexWallet,
  token0: string,
  token1: string,
  reverse: boolean,
  protocol: string,
  chainId: string,
  amount: string,
  slippage: number,
) {
  const provider = new ethers.providers.JsonRpcProvider(NETWORKS[chainId]);
  const routerAddress = INFRA[chainId].ROUTER;
  const wallet = dexWallet.wallet;
  const router = new ethers.Contract(routerAddress, infraRouterAbi, dexWallet.wallet);

  // METHOD 1

  //const url = `${BASEURL}/swap/${dexWallet.walletAddress}/${token0}/${token1}/${reverse}/${protocol}/${chainId}/${amount}`;
  // const url = `http://localhost:3001/swap/${dexWallet.walletAddress}/${token0}/${token1}/${reverse}/${protocol}/${chainId}/${amount}`;
  // const response = await fetch(url, {
  //   method: "POST",
  // });
  // if (!response.ok) {
  //   throw new Error(`HTTP error! status: ${response.status}`);
  // }
  // const data = await response.json().then(data => data);

  // METHOD 2

  const token0AddressUrl = `${BASEURL}/${chainId}/${protocol}/tokens/${token0}`;

  let response = await fetch(token0AddressUrl, {
    method: "GET",
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  const token0Info = await response.json().then(data => data);

  const token1AddressUrl = `${BASEURL}/${chainId}/${protocol}/tokens/${token1}`;

  response = await fetch(token1AddressUrl, {
    method: "GET",
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  const token1Info = await response.json().then(data => data);

  const data = await buildSwap(
    dexWallet?.walletAddress,
    String(token0Info.address),
    String(token1Info.address),
    Boolean(reverse),
    protocol,
    chainId,
    String(amount),
    slippage,
  );

  await Promise.all(data?.Approvals).then(async approvals => {
    if (approvals.length > 0) {
      for (const approval of approvals) {
        const gasPrice = await provider.getFeeData();
        if (approval && Object.keys(approval).length > 0) {
          const approveTx = {
            to: approval.to,
            value: approval.value,
            data: approval.data,
            gasLimit: 8000000,
            gasPrice: String(gasPrice?.gasPrice),
          };

          try {
            const txApprove = await wallet.sendTransaction(approveTx);
            const resultApprove = await waitForTx(provider, txApprove?.hash);
            pc.log("Approval Transaction Result: ", resultApprove);
          } catch (error) {
            pc.error("Approval Transaction Error: ", error);
          }
        }
      }
    } else {
      pc.log("No approvals required");
    }
  });

  const gasPrice = await provider.getFeeData();

  const calldatasArray = await Promise.all(data?.Calldatas).then(async calldatas => {
    calldatas.map((calldata: { to: any; value: any; data: any }) => ({
      to: calldata.to,
      value: calldata.value,
      data: calldata.data,
    }));

    return calldatas;
  });

  const TokensReturn = data?.TokensReturn;

  if (calldatasArray?.length === 0) return pc.error("No calldatas found");

  try {
    const simulationResult: unknown = await router?.callStatic?.execute(calldatasArray, TokensReturn, {
      gasLimit: 8000000,
      gasPrice: String(gasPrice?.gasPrice),
    });
    pc.log("Simulation successful:", await simulationResult);
  } catch (error) {
    console.error("Simulation failed:", error);
    return;
  }

  const tx = await router?.execute(calldatasArray, TokensReturn, {
    gasLimit: 8000000,
    gasPrice: String(gasPrice?.gasPrice),
  });
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
    amount: string;
    slippage: number;
  }>,
) {
  pc.log("Execute Batch Swap");
  const provider = swaps[0].dexWallet?.wallet?.provider;
  const gasPrice = await provider.getFeeData();
  const wallet = swaps[0].dexWallet.wallet;
  const routerAddress = INFRA[swaps[0].chainId].ROUTER;
  const router = new ethers.Contract(routerAddress, infraRouterAbi, wallet);

  let allApprovals: unknown[] = [];
  let allCalldatas: unknown[] = [];
  let allTokensReturn: any[] = [];

  await Promise.all(
    swaps.map(async swap => {
      //const token0AddressUrl = `${BASEURL}/${swap.chainId}/${swap.protocol}/tokens/${swap.token0}`;
      const token0AddressUrl = `http://localhost:3001/${swap.chainId}/${swap.protocol}/tokens/${swap.token0}`;

      let response = await fetch(token0AddressUrl, {
        method: "GET",
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const token0Info = await response.json().then(data => data);

      //const token1AddressUrl = `${BASEURL}/${swap.chainId}/${swap.protocol}/tokens/${swap.token1}`;
      const token1AddressUrl = `http://localhost:3001/${swap.chainId}/${swap.protocol}/tokens/${swap.token1}`;

      response = await fetch(token1AddressUrl, {
        method: "GET",
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const token1Info = await response.json().then(data => data);

      swap.token0 = String(token0Info.address);
      swap.token1 = String(token1Info.address);
    }),
  );

  for (let swap of swaps) {
    // const url = `${BASEURL}/swap/${swap.dexWallet.walletAddress}/${swap.token0}/${swap.token1}/${swap.reverse}/${swap.protocol}/${swap.chainId}/${swap.amount}`;
    // const url = `http://localhost:3001/swap/${swap.dexWallet.walletAddress}/${swap.token0}/${swap.token1}/${swap.reverse}/${swap.protocol}/${swap.chainId}/${swap.amount}`;
    // const response = await fetch(url, { method: "POST" });
    // if (!response.ok) {
    //   throw new Error(`HTTP error! status: ${response.status}`);
    // }
    // const data = await response.json();

    const data = await buildBatchSwap(
      swaps.map(swap => ({
        address: swap.dexWallet.walletAddress,
        token0: swap.token0,
        token1: swap.token1,
        reverse: Boolean(swap.reverse),
        protocol: swap.protocol,
        chainId: swap.chainId,
        amount: String(swap.amount),
        slippage: swap.slippage,
      })),
    );

    if (data.TokensReturn && data.TokensReturn.length > 0) {
      allTokensReturn.push(...data.TokensReturn);
    }

    if (data.Approvals && data.Approvals.length > 0) {
      allApprovals.push(...data.Approvals);
    }

    if (data.Calldatas && data.Calldatas.length > 0) {
      allCalldatas.push(...data.Calldatas);
    }

    if (allApprovals.length != 0) {
      for (const approval of allApprovals) {
        const approveTx = {
          to: (approval as { to: string }).to,
          value: (approval as { value: number }).value!,
          data: (approval as { data: any }).data,
          gasPrice: String(gasPrice?.gasPrice), // String(gasPrice?.gasPrice),
          maxFeePerGas: String(gasPrice?.maxFeePerGas),
        };

        try {
          const txApprove = await wallet.sendTransaction(approveTx);
          const broadcaster = await waitForTx(provider, txApprove.hash);

          pc.log("Approval Transaction Result: ", broadcaster);
        } catch (error) {
          console.error("Approval Transaction Error: ", error);
        }
      }
    } else {
      pc.log("No approvals required");
    }

    // Simulazione della transazione utilizzando callStatic per eseguire senza consumare gas
    try {
      const simulationResult = await router.callStatic.execute(allCalldatas, allTokensReturn);

      pc.log("Simulation successful:", simulationResult);
    } catch (error) {
      pc.error("Simulation failed:", error);

      return; // Interrompe l'esecuzione se la simulazione fallisce
    }

    try {
      const tx = await router.execute(allCalldatas, allTokensReturn);

      const broadcaster = await waitForTx(provider, tx.hash);
      pc.log("Transaction executed", broadcaster);

      return broadcaster;
    } catch (error) {
      console.error("Transaction failed:", error);
    }
  }
}
