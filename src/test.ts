import fetch from "node-fetch";
import BatcherABI from "./abis/Batcher.json";
import { ethers } from "ethers";
import { waitForTx } from "./utils/networkUtils";
import dotenv from "dotenv";
dotenv.config();

async function postRequest() {
  const url =
    "http://localhost:3001/swap/0x3c499c542cef5e3811e1192ce70d8cc03d5c3359/0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174/0xb33EaAd8d922B1083446DC23f610c2567fB5180f/false/uni-v3/137/1000000";

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
  const dataParsed = JSON.parse(JSON.stringify(data));

  const gasPrice = await provider.getFeeData();

  // Approve To Router
  const calldataWithGas = {
    to: dataParsed?.approvalToRouter?.to,
    value: dataParsed?.approvalToRouter?.value,
    data: dataParsed?.approvalToRouter?.data,
    gasPrice: String(gasPrice?.gasPrice),
    gasLimit: 5000000,
  };

  const txApprove = await wallet.sendTransaction(calldataWithGas);
  const result = await waitForTx(provider, txApprove?.hash);

  console.log(calldataWithGas);
  console.log("Approve result:", result);

  const calldataWithGasTransferFrom = {
    to: dataParsed?.transferFromTx?.to,
    value: dataParsed?.transferFromTx?.value,
    data: dataParsed?.transferFromTx?.data,
  };

  const calldataApproveRouterToUni = {
    to: dataParsed?.approvalRouterToUni?.to,
    value: dataParsed?.approvalRouterToUni?.value,
    data: dataParsed?.approvalRouterToUni?.data,
  };

  const calldataSwapRouterToUni = {
    to: dataParsed?.swapTx?.to,
    value: dataParsed?.swapTx?.value,
    data: dataParsed?.swapTx?.data,
  };

  const txSwap = await batcher?.multicall(
    [calldataWithGasTransferFrom, calldataApproveRouterToUni, calldataSwapRouterToUni],
    {
      gasLimit: 8000000,
      gasPrice: String(gasPrice?.gasPrice),
    },
  );

  const broadcaster = await waitForTx(provider, await txSwap?.hash);
  console.log(broadcaster);
}

async function getRequest() {
  await postRequest().catch(console.error);
}

getRequest().catch(console.error);
