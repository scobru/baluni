import { ethers } from "ethers";
import uniswapV3FactoryAbi from "../abis/uniswap/UniswapV3Factory.json";
import uniswapV3PoolAbi from "../abis/uniswap/UniswapV3Pool.json";
import erc20Abi from "../abis/common/ERC20.json"; // Assuming you have ERC20 ABI for fetching decimals
import { loadPrettyConsole } from "./prettyConsole";

const prettyConsole = loadPrettyConsole();

export async function quotePair(tokenAAddress: string, tokenBAddress: string) {
  const uniswapV3FactoryAddress = "0x1F98431c8aD98523631AE4a59f267346ea31F984";
  const { PRIVATE_KEY } = process.env;

  if (!PRIVATE_KEY) {
    prettyConsole.log("Private key missing from env variables");
    return;
  }

  // Connect to the BSC mainnet
  // const provider = ethers.getDefaultProvider();
  const provider = new ethers.providers.JsonRpcProvider("https://polygon-rpc.com/");

  // Sign the transaction with the contract owner's private key
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

  // Get the contract instance
  const factoryContract = new ethers.Contract(uniswapV3FactoryAddress, uniswapV3FactoryAbi, wallet);

  const walletAddress = await wallet.getAddress();
  const walletBalance = await wallet.getBalance();

  const tokenAContract = new ethers.Contract(tokenAAddress, erc20Abi, wallet);
  const tokenBContract = new ethers.Contract(tokenBAddress, erc20Abi, wallet);

  // Fetch decimals for both tokens
  const tokenADecimals = await tokenAContract.decimals();
  const tokenBDecimals = await tokenBContract.decimals();

  prettyConsole.log(walletAddress + ":", walletBalance.toBigInt());

  const txInputs = [tokenAAddress, tokenBAddress, 3000];

  try {
    const poolAddress = await factoryContract.getPool(...txInputs);
    prettyConsole.log("Pool address:", poolAddress);

    const poolContract = new ethers.Contract(poolAddress, uniswapV3PoolAbi, wallet);
    const slot0 = await poolContract.slot0();

    const { tick } = slot0;
    const tokenBPrice = 1 / (1.0001 ** tick * 10 ** -12);

    if (tokenADecimals == 8) {
      prettyConsole.log("Tick:", tick, "Price:", (tokenBPrice / 1e5) * 2);
      return (tokenBPrice / 1e5) * 2;
    } else {
      prettyConsole.log("Tick:", tick, "Price:", tokenBPrice);
      return tokenBPrice;
    }
  } catch {
    return false;
  }
}
