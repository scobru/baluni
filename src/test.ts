import fetch from "node-fetch";
import BatcherABI from "./abis/Batcher.json";
import { ethers } from "ethers";
import { waitForTx } from "./utils/networkUtils";
import dotenv from "dotenv";
dotenv.config();

async function postRequest() {
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

  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY as string, provider);
  const data = await response.json().then(data => data);
  const batcher = new ethers.Contract("0xA7d0bdC6235a745d283aCF6b036b54E77AFFCAd5", BatcherABI, wallet);

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

async function getRequest() {
  await postRequest();
}

getRequest();
