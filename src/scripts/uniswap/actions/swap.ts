import infraRouterAbi from "baluni-api/dist/abis/infra/Router.json";
import { ethers } from "ethers";
import { DexWallet } from "../../../utils/dexWallet";
import { waitForTx } from "../../../utils/networkUtils";
import { loadPrettyConsole } from "../../../utils/prettyConsole";
//import { buildSwap, buildBatchSwap, NETWORKS, INFRA, BASEURL } from "baluni-api";

// DEV ONLY
import { buildSwap, NETWORKS, INFRA, BASEURL } from "../../../../../baluni-api/dist";

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

    const tx = await router.execute(calldatasArray, TokensReturn);
    const txReceipt = await waitForTx(provider, await tx?.hash, dexWallet.walletAddress);
    pc.log("Transaction executed, receipt:", txReceipt);
  } catch (error) {
    console.error("Simulation failed:", error);
    return;
  }
}
