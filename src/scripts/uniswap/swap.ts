import infraRouterAbi from "baluni-api/dist/abis/infra/Router.json";
import { ethers } from "ethers";
import { DexWallet } from "../../utils/dexWallet";
import { waitForTx } from "../../utils/networkUtils";
import { loadPrettyConsole } from "../../utils/prettyConsole";
//import { buildSwap, buildBatchSwap, NETWORKS, INFRA, BASEURL } from "baluni-api";

// TEST ONLY
import { buildSwap, buildBatchSwap, NETWORKS, INFRA, BASEURL } from "../../../../baluni-api/dist";

const pc = loadPrettyConsole();

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

  const gasLimit = 3000000;
  const gasPrice = await provider?.getGasPrice();
  const gas = gasPrice;

  // METHOD 1
  //-------------------------------------------------------------------------------------
  // const url = `${BASEURL}/swap/${dexWallet.walletAddress}/${token0}/${token1}/${reverse}/${protocol}/${chainId}/${amount}`;
  // const url = `http://localhost:3001/swap/${dexWallet.walletAddress}/${token0}/${token1}/${reverse}/${protocol}/${chainId}/${amount}`;
  // const response = await fetch(url, {
  //   method: "POST",
  // });
  // if (!response.ok) {
  //   throw new Error(`HTTP error! status: ${response.status}`);
  // }
  // const data = await response.json().then(data => data);

  // METHOD 2
  //-------------------------------------------------------------------------------------
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
    dexWallet?.wallet,
    dexWallet?.walletAddress,
    String(token0Info.address),
    String(token1Info.address),
    Boolean(reverse),
    protocol,
    chainId,
    String(amount),
    slippage,
  );

  await Promise.resolve(data?.Approvals).then(async approvals => {
    if (approvals.length > 0) {
      pc.log("Sending approvals");

      for (const approval of approvals) {
        if (approval && Object.keys(approval).length > 0) {
          try {
            const txApprove = await wallet.sendTransaction(approval);
            const resultApprove = await waitForTx(provider, txApprove?.hash, dexWallet.walletAddress);
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

  const calldatasArray = await Promise.all(data?.Calldatas);
  const TokensReturn = data?.TokensReturn;

  if (calldatasArray?.length === 0) return pc.error("No calldatas found");

  try {
    pc.log("Sending calldatasArray");
    const simulationResult: unknown = await router?.callStatic?.execute(calldatasArray, TokensReturn);
    pc.log("Simulation successful:", await simulationResult);

    if (simulationResult === false) {
      pc.error("Simulation failed");
      return;
    }

    pc.log("Executing transaction...");
    if (simulationResult) {
      const tx = await router.execute(calldatasArray, TokensReturn);
      const txReceipt = await waitForTx(provider, await tx?.hash, dexWallet.walletAddress);
      pc.log("Transaction executed, receipt:", txReceipt);
    }
  } catch (error) {
    console.error("Simulation failed:", error);
    return;
  }
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

  const provider = new ethers.providers.JsonRpcProvider(NETWORKS[swaps[0].chainId]);
  const wallet = swaps[0].dexWallet.wallet;
  const routerAddress = INFRA[swaps[0].chainId].ROUTER;
  const router = new ethers.Contract(routerAddress, infraRouterAbi, wallet);

  // const gasLimit = 9000000;
  // const gasPrice = await provider?.getGasPrice();
  // const gas = gasPrice.add(gasPrice.div(10));

  let allApprovals: unknown[] = [];
  let allCalldatas: unknown[] = [];
  let allTokensReturn: any[] = [];

  await Promise.all(
    swaps.map(async swap => {
      const token0AddressUrl = `${BASEURL}/${swap.chainId}/${swap.protocol}/tokens/${swap.token0}`;
      //const token0AddressUrl = `http://localhost:3001/${swap.chainId}/${swap.protocol}/tokens/${swap.token0}`;

      let response = await fetch(token0AddressUrl, {
        method: "GET",
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const token0Info = await response.json().then(data => data);

      const token1AddressUrl = `${BASEURL}/${swap.chainId}/${swap.protocol}/tokens/${swap.token1}`;
      //const token1AddressUrl = `http://localhost:3001/${swap.chainId}/${swap.protocol}/tokens/${swap.token1}`;

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

  // const url = `${BASEURL}/swap/${swap.dexWallet.walletAddress}/${swap.token0}/${swap.token1}/${swap.reverse}/${swap.protocol}/${swap.chainId}/${swap.amount}`;
  // const url = `http://localhost:3001/swap/${swap.dexWallet.walletAddress}/${swap.token0}/${swap.token1}/${swap.reverse}/${swap.protocol}/${swap.chainId}/${swap.amount}`;
  // const response = await fetch(url, { method: "POST" });
  // if (!response.ok) {
  //   throw new Error(`HTTP error! status: ${response.status}`);
  // }
  // const data = await response.json();

  const data = await buildBatchSwap(
    swaps.map(swap => ({
      wallet: swap.dexWallet.wallet,
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
        value: (approval as { value: number }).value,
        data: (approval as { data: any }).data,
      };

      try {
        pc.log("Sending approvals");
        const txApprove = await wallet.sendTransaction(approveTx);
        const broadcaster = await waitForTx(
          swaps[0].dexWallet.walletProvider,
          txApprove.hash,
          swaps[0].dexWallet.walletAddress,
        );
        pc.log("Approval Transaction Result: ", broadcaster);
      } catch (error) {
        console.error("Approval Transaction Error: ", error);
      }
    }
  } else {
    pc.log("No approvals required");
  }

  try {
    const simulationResult = await router.callStatic.execute(allCalldatas, allTokensReturn);

    pc.log("Simulation successful:", simulationResult);

    if (simulationResult) {
      const tx = await router.execute(allCalldatas, allTokensReturn);

      const broadcaster = await waitForTx(wallet.provider, tx.hash, swaps[0].dexWallet.walletAddress);
      pc.log("Transaction executed", broadcaster);
    } else {
      pc.error("Simulation failed");
    }
  } catch (error) {
    pc.error("Simulation failed:", error);
    return;
  }
}
