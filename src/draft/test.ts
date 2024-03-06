import fetch from "node-fetch";
import BatcherABI from "../abis/Batcher.json";
import Permit2ABI from "../abis/uniswap/Permit2.json";
import { ethers } from "ethers";
import { waitForTx } from "../utils/networkUtils";
import dotenv from "dotenv";
dotenv.config();

async function postRequest() {
  const url =
    "http://localhost:3001/swap/0x8aA5F726d9F868a21a8bd748E2f1E43bA31eb670/USDC.E/WETH/true/uni-v3/137/0.0002";

  const response = await fetch(url, {
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const provider = new ethers.providers.JsonRpcProvider(
    "https://polygon-mainnet.g.alchemy.com/v2/nPBTC9lNonD1KsZGmuXSRGfVh6O63x2_",
  );

  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY as string, provider);
  const data = await response.json().then(data => data);
  const batcher = new ethers.Contract("0xA7d0bdC6235a745d283aCF6b036b54E77AFFCAd5", BatcherABI, wallet);

  Promise.resolve(await data);

  const gasPrice = await provider.getFeeData();

  if (data.Approvals) {
    if (Object.keys(data.Approvals.ROUTER).length > 0) {
      const approveTxRouter = {
        to: data?.Approvals["ROUTER"]?.to,
        value: data?.Approvals["ROUTER"]?.value,
        data: data?.Approvals["ROUTER"]?.data,
        gasPrice: String(gasPrice?.gasPrice),
        gasLimit: 10000000,
      };

      const txApproveRouter = await wallet.sendTransaction(approveTxRouter);
      const resultApproveRouter = await waitForTx(provider, txApproveRouter?.hash);

      console.log("Approve Router: ", resultApproveRouter);
    }

    if (Object.keys(data.Approvals.BATCHER).length > 0) {
      const approveTxBatcher = {
        to: data?.Approvals["BATCHER"]?.to,
        value: data?.Approvals["BATCHER"]?.value,
        data: data?.Approvals["BATCHER"]?.data,
        gasPrice: String(gasPrice?.gasPrice),
        gasLimit: 10000000,
      };
      const txApproveBatcher = await wallet.sendTransaction(approveTxBatcher);
      const resultApproveBatcher = await waitForTx(provider, txApproveBatcher?.hash);

      console.log("Approve Batcher: ", resultApproveBatcher);
    }
  }

  /* if (data.PermitData) {
    const permit2 = new ethers.Contract("0x8BD8e5C3e3c6FfBE9E6f9b6Fb3e4A3C5A3bA6Aa9", Permit2ABI, wallet);

    // sign typed data
    const signatureRouter = await wallet._signTypedData(
      data?.PermitData.ROUTER.domain,
      data?.PermitData.ROUTER.types,
      data?.PermitData.ROUTER.values,
    );
    const permitSingleRouter = data?.PermitData.ROUTER.permitSingle;

    const signatureBatcher = await wallet._signTypedData(
      data?.PermitData.BATCHER.domain,
      data?.PermitData.BATCHER.types,
      data?.PermitData.BATCHER.values,
    );

    const permitSingleBatcher = data?.PermitData.BATCHER.permitSingle;

    const dataPermit2Router = permit2.interface.encodeFunctionData("permit", [
      wallet.address,
      permitSingleRouter,
      signatureRouter,
    ]);

    const dataPermit2Batcher = permit2.interface.encodeFunctionData("permit", [
      wallet.address,
      permitSingleBatcher,
      signatureBatcher,
    ]);

    txPermitRouter = {
      to: "0x8BD8e5C3e3c6FfBE9E6f9b6Fb3e4A3C5A3bA6Aa9",
      value: 0,
      data: dataPermit2Router,
    };

    txPermitBatcher = {
      to: "0x8BD8e5C3e3c6FfBE9E6f9b6Fb3e4A3C5A3bA6Aa9",
      value: 0,
      data: dataPermit2Batcher,
    };
  } */

  const transferFromSenderToBatcher = {
    to: data?.Calldatas?.transferFromSenderToBatcher?.to,
    value: data?.Calldatas?.transferFromSenderToBatcher?.value,
    data: data?.Calldatas?.transferFromSenderToBatcher?.data,
  };

  const approvalBatcherToRouter = {
    to: data?.Calldatas?.approvalBatcherToRouter?.to,
    value: data?.Calldatas?.approvalBatcherToRouter?.value,
    data: data?.Calldatas?.approvalBatcherToRouter?.data,
  };

  const swapBatcherToRouter = {
    to: data?.Calldatas?.swapBatcherToRouter?.to,
    value: data?.Calldatas?.swapBatcherToRouter?.value,
    data: data?.Calldatas?.swapBatcherToRouter?.data,
  };

  const tx = await batcher?.multicall([transferFromSenderToBatcher, approvalBatcherToRouter, swapBatcherToRouter], {
    gasLimit: 10000000,
    gasPrice: String(gasPrice?.gasPrice),
  });

  const broadcaster = await waitForTx(provider, await tx?.hash);
  console.log("Batcher: ", broadcaster);
}

async function getRequest() {
  await postRequest();
}

getRequest();
