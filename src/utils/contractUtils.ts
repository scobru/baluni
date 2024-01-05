import { BigNumber, Contract, providers } from "ethers";
import fs from "fs";
import { POLYGON } from "./networks";
import { DexWallet } from "./dexWallet";
import { loadPrettyConsole } from "./prettyConsole";

const prettyConsole = loadPrettyConsole();
const TX_FILE = "./transactions.json";
const provider = new providers.JsonRpcProvider(POLYGON[0]); // Sostituisci con il tuo provider

export async function callContract(
  data: string,
  value: string,
  to: string,
  dexWallet: DexWallet
) {
  const { maxFeePerGas, maxPriorityFeePerGas } =
    await dexWallet.wallet.provider.getFeeData();

  if (!maxFeePerGas || !maxPriorityFeePerGas) {
    throw new Error("Failed to fetch gas fee data");
  }

  // Leggi le transazioni esistenti
  let transactions = readTransactions();

  // Controlla il numero di transazioni in attesa
  while (
    transactions.filter(
      (tx: { status: string }) =>
        tx.status === "pending" || tx.status === "dropped"
    ).length > 2
  ) {
    await updateTransactionStatus();
    prettyConsole.log("Waiting for some transactions to complete...");

    await new Promise((resolve) => setTimeout(resolve, 10000)); // attendi 10 secondi
    transactions = readTransactions(); // Aggiorna le transazioni
  }

  const txResponse = await dexWallet.wallet.sendTransaction({
    data: data,
    to: to,
    value: value,
    from: dexWallet.walletAddress,
    maxFeePerGas: maxFeePerGas,
    maxPriorityFeePerGas: maxPriorityFeePerGas,
  });

  prettyConsole.success("Done! Tx Hash:", txResponse.hash);

  // Salva la transazione nel file JSON
  transactions.push({
    hash: txResponse.hash,
    status: "pending",
  });

  writeTransactions(transactions);

  return txResponse;
}

export async function callContractMethod(
  contract: Contract,
  method: string,
  inputs: any[],
  gasPrice: BigNumber,
  value?: BigNumber
) {
  // Leggi le transazioni esistenti

  let transactions = readTransactions();

  // Controlla il numero di transazioni in attesa
  while (
    transactions.filter((tx: { status: string }) => tx.status === "pending")
      .length > 2
  ) {
    await updateTransactionStatus();

    prettyConsole.log("Waiting for some transactions to complete...");
    await new Promise((resolve) => setTimeout(resolve, 10000)); // attendi 10 secondi
    transactions = readTransactions(); // Aggiorna le transazioni
  }

  prettyConsole.info(`${method}(${inputs})`);

  let gasLimit = BigNumber.from(500000);

  try {
    const gasEstimate: BigNumber = await contract.estimateGas[method](
      ...inputs
    );
    gasLimit = gasEstimate.mul(2);
    prettyConsole.log("Gas estimate:", gasEstimate.toBigInt());
    prettyConsole.log("Gas limit:", gasLimit.toBigInt());
  } catch (error) {
    console.log("Default gas limit:", gasLimit.toBigInt());
  }

  const txResponse = await contract[method](...inputs, {
    value: value,
    gasPrice: gasPrice,
    gasLimit: gasLimit,
  });
  prettyConsole.success("Done! Tx Hash:", txResponse.hash);

  // Salva la transazione nel file JSON
  transactions.push({
    hash: txResponse.hash,
    status: "pending",
  });
  writeTransactions(transactions);

  return txResponse;
}

// Funzione per leggere le transazioni da un file
function readTransactions() {
  try {
    const txData = fs.readFileSync(TX_FILE);
    return JSON.parse(txData as any);
  } catch (e) {
    prettyConsole.error("Unable to read transactions file:", e);
    return []; // restituisce un array vuoto se non riesce a leggere
  }
}

// Funzione per scrivere le transazioni in un file
function writeTransactions(transactions: any) {
  try {
    fs.writeFileSync(TX_FILE, JSON.stringify(transactions, null, 2));
  } catch (e) {
    prettyConsole.error("Unable to write transactions file:", e);
  }
}

async function updateTransactionStatus() {
  let transactions = readTransactions();
  let updatedTransactions = [];

  for (let i = 0; i < transactions.length; i++) {
    if (transactions[i].status === "pending") {
      try {
        const receipt = await provider.getTransactionReceipt(
          transactions[i].hash
        );
        if (receipt && receipt.confirmations > 0) {
          // Transazione confermata, la segna per la rimozione
          prettyConsole.success(
            `Transaction confirmed! Hash: ${transactions[i].hash}`
          );
          continue; // Salta l'aggiunta di questa transazione agli aggiornamenti perché è confermata
        }
      } catch (error) {
        console.error(`Error fetching transaction receipt: ${error}`);
      }
    }

    if (transactions[i].status === "dropped") {
      try {
        const receipt = await provider.getTransactionReceipt(
          transactions[i].hash
        );
        if (receipt && receipt.confirmations > 0) {
          // Transazione confermata, la segna per la rimozione
          prettyConsole.success(
            `Transaction dropped! Hash: ${transactions[i].hash}`
          );
          continue; // Salta l'aggiunta di questa transazione agli aggiornamenti perché è confermata
        }
      } catch (error) {
        console.error(`Error fetching transaction receipt: ${error}`);
      }
    }

    // Se lo stato non è "completed" (o qualsiasi altro stato che indichi il completamento), aggiungilo per l'aggiornamento
    if (transactions[i].status !== "confirmed") {
      updatedTransactions.push(transactions[i]);
    }
  }

  // Riscrivi il file JSON con le transazioni non confermate o ancora in attesa
  writeTransactions(updatedTransactions);
}

export async function simulateContractMethod(
  contract: Contract,
  method: string,
  inputs: any[],
  gasPrice: BigNumber
) {
  console.log(`${method}(${inputs})`);

  let gasLimit = BigNumber.from(500000);

  try {
    const gasEstimate: BigNumber = await contract.estimateGas[method](
      ...inputs
    );
    const gasLimit = gasEstimate.mul(2);
    console.log("Gas estimate:", gasEstimate.toBigInt());
    console.log("   Gas limit:", gasLimit.toBigInt());
  } catch (error) {
    console.log("Default gas limit:", gasLimit.toBigInt());
  }

  const txResponse = await contract.callStatic[method](...inputs, {
    gasPrice,
    gasLimit,
  });
  console.log("Simulate! Tx:", txResponse);
  return txResponse;
}