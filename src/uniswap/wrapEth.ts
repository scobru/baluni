import chalk from "chalk";
import { DexWallet } from "../dexWallet";
import { ethers } from "ethers";
import { WNATIVE } from "../config";

import { loadPrettyConsole } from "../utils/prettyConsole";

const prettyConsole = loadPrettyConsole();
const WETH_ABI = [
  // Wrap ETH
  "function deposit() payable",
  // Unwrap ETH
  "function withdraw(uint wad) public",
  // get WETH balance
  "function balanceOf(address owner) view returns (uint256)",
];

export async function wrapETH(dexWallet: DexWallet, amount: string) {
  const signer = dexWallet.wallet;
  const wethContract = new ethers.Contract(WNATIVE, WETH_ABI, signer);

  console.log(`Wrapping ${amount} ETH...`);
  const depositTx = await wethContract.deposit({
    value: ethers.utils.parseEther(amount),
  });
  prettyConsole.success("Done! Tx Hash:", depositTx.hash);
  await depositTx.wait();
  const wethBalance = await wethContract.balanceOf(signer.address);

  console.log(
    chalk.green(
      `Wrapped ${amount} NATIVE into ${ethers.utils.formatUnits(
        wethBalance,
        18
      )} WNATIVE`
    )
  );
}

export async function unwrapETH(dexWallet: DexWallet, amount: string) {
  const signer = dexWallet.wallet;
  const wethContract = new ethers.Contract(WNATIVE, WETH_ABI, signer);

  console.log(`Unwrapping ${amount} WNATIVE...`);
  const withdrawTx = await wethContract.withdraw(
    ethers.utils.parseEther(amount)
  );
  prettyConsole.success("Done! Tx Hash:", withdrawTx.hash);
  await withdrawTx.wait();
  const wethBalance = await wethContract.balanceOf(signer.address);

  console.log(
    chalk.green(
      `Unwrapped ${amount} WNATIVE into ${ethers.utils.formatUnits(
        wethBalance,
        18
      )} NATIVE`
    )
  );
}
