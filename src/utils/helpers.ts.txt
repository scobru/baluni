import hre from "hardhat";
import { ethers, network } from "hardhat";
import { getUniswapInstances } from "./uniswapHelpers";
import axios from "axios";
import { priceToClosestTick, nearestUsableTick, encodeSqrtRatioX96, FeeAmount, TICK_SPACINGS } from '@uniswap/v3-sdk/dist/'
import { tickToPrice } from '@uniswap/v3-sdk'
import { ChainId, Price, Currency, CurrencyAmount, Token, TokenAmount } from '@uniswap/sdk-core'
import { parseUnits } from '@ethersproject/units'
import JSBI from 'jsbi';
import { ERC20, IERC20, UniswapPositionManager } from "../typechain";


/**
 * Deploy a contract by name without constructor arguments
 */
async function deploy(contractName) {
    let Contract = await ethers.getContractFactory(contractName);
    return await Contract.deploy({gasLimit: 8888888});
}

/**
 * Deploy a contract by name with constructor arguments
 */
async function deployArgs(contractName, ...args) {
    let Contract = await ethers.getContractFactory(contractName);
    // return await Contract.deploy(...args);
    return await Contract.deploy(...args, {gasLimit: 8888888}); // doesnt work on arbitrum
}

/**
 * Deploy a contract with abi
 */
 async function deployWithAbi(contract, deployer, ...args) {
    let Factory = new ethers.ContractFactory(contract.abi, contract.bytecode, deployer);
    return await Factory.deploy(...args, {gasLimit: 8888888});
}

/**
 * Deploy a contract with abi and link to a library
 * Currently hardcoded for uniswap NFTDescriptor library
 */
 async function deployWithAbiAndLink(contract, libraryName, libraryAddress, deployer, ...args) {
    let linkReferences = {
        'NFTDescriptor.sol': {
          NFTDescriptor: [
            {
              length: 20,
              start: 1681,
            },
          ],
        },
    }
    let libraries = {
        [libraryName]: libraryAddress,
    };
    const linkedBytecode = linkBytecodeToLibraries(contract.bytecode, linkReferences, libraries)
    let Factory = new ethers.ContractFactory(contract.abi, linkedBytecode, deployer);
    return await Factory.deploy(...args, {gasLimit: 8888888});
}

/**
 * Deploy a contract by name without constructor arguments
 * Link contract to a library address
 */
 async function deployAndLink(contractName, libraryName, libraryAddress) {
    const params = {
        libraries: {
            [libraryName]: libraryAddress
        }
    }
    let Contract = await ethers.getContractFactory(contractName, params);
    return await Contract.deploy({gasLimit: 8888888});
}

/**
 * Link bytecode to library by just using library name and address
 * libraries object must be in the format:
 * {
 *  [NFTDescriptor.sol:NFTDescriptor]: libraryAddress
 * }
 * Taken from:
 * https://github.com/ethers-io/ethers.js/issues/195#issuecomment-1212815642
 * @param {*} bytecode 
 * @param {*} libraries 
 * @returns 
 */
function linkLibrary(bytecode, libraries) {
    let linkedBytecode = bytecode
    for (const [name, address] of Object.entries(libraries)) {
      const placeholder = `__\$${ethers.utils.solidityKeccak256(['string'], [name]).slice(2, 36)}\$__`
      const formattedAddress = ethers.utils.getAddress(address).toLowerCase().replace('0x', '')
      if (linkedBytecode.indexOf(placeholder) === -1) {
        throw new Error(`Unable to find placeholder for library ${name}`)
      }
      while (linkedBytecode.indexOf(placeholder) !== -1) {
        linkedBytecode = linkedBytecode.replace(placeholder, formattedAddress)
      }
    }
    return linkedBytecode
}

/**
 * Link bytecode to libraries
 * For uniswap libraries
 * Taken from:
 * https://github.com/ethers-io/ethers.js/issues/195#issuecomment-795676943
 * @param {*} bytecode 
 * @param {*} linkReferences 
 * @param {*} libraries 
 * @returns 
 */
function linkBytecodeToLibraries(bytecode, linkReferences, libraries) {
    Object.keys(linkReferences).forEach((fileName) => {
      Object.keys(linkReferences[fileName]).forEach((contractName) => {
        if (!libraries.hasOwnProperty(contractName)) {
          throw new Error(`Missing link library name ${contractName}`)
        }
        const address = ethers.utils.getAddress(libraries[contractName]).toLowerCase().slice(2)
        linkReferences[fileName][contractName].forEach(({ start: byteStart, length: byteLength }) => {
          const start = 2 + byteStart * 2
          const length = byteLength * 2
          bytecode = bytecode
            .slice(0, start)
            .concat(address)
            .concat(bytecode.slice(start + length, bytecode.length))
        })
      })
    })
    return bytecode
  }

/**
 * Deposit liquidity in a given pool
 * @param {Contract} positionManager uni v3 position manager contract
 * @param {String} amount0 amount0 to deposit
 * @param {String} amount1 amount1 to deposit
 * @param {String} token0 token0 to deposit
 * @param {String} token1 token1 to deposit
 * @param {String} fee pool fee
 * @param {String} lowerTick position lower tick
 * @param {String} upperTick position upper tick
 * @param {String} receiverAddress address to receive the position nft
 * @returns {BigNumber} nftId the id of the position nft 
 */
async function depositLiquidityInPool(positionManager, amount0, amount1, token0, token1, fee, lowerTick, upperTick, receiverAddress) {
    let approveAmount = bnDecimal(1000000000);
    await token0.approve(positionManager.address, approveAmount);
    await token1.approve(positionManager.address, approveAmount);

    const pendingBlock = await network.provider.send("eth_getBlockByNumber", ["pending", false])
    let tx = await positionManager.mint({
        token0: token0.address,
        token1: token1.address,
        fee: fee,
        tickLower: lowerTick,
        tickUpper: upperTick,
        amount0Desired: amount0,
        amount1Desired: amount1,
        amount0Min: 0,
        amount1Min: 0,
        recipient: receiverAddress,
        deadline: pendingBlock.timestamp
    })
    let depositEvent = await getEvent(tx, 'IncreaseLiquidity');
    let nftId = depositEvent.args[0];
    let amount0Deposited = depositEvent.args[0].amount0;
    let amount1Deposited = depositEvent.args[0].amount1;
    return {
        nftId: nftId,
        amount0: amount0Deposited,
        amount1: amount1Deposited
    }
}

/**
 * Calculate amount to swap when repositioning
 * @param {Contract} LPManager UniswapPositionManager instance
 * @param {String} positionId nft id of the position
 * @param {BigNumber} amount0 token 0 amount for staking
 * @param {BigNumber} amount1 token 1 amount for staking
 * @param {BigNumber} token0Decimals token 0 decimals
 * @param {BigNumber} token1Decimals token 1 decimals
 * @param {BigNumber} newTickLower lower tick of the new position
 * @param {BigNumber} newTickUpper upper tick of the new position
 * @param {bool} considerPoolLiquidity if true, consider price swap impact on uni v3 pool
 * @returns [BigNumber, bool] swapAmount and swap 0 -> 1 if true, 1 -> 0 if false
 */
 async function getRepositionSwapAmount(LPManager: UniswapPositionManager, positionId, amount0, amount1, 
        token0Decimals, token1Decimals, newTickLower, newTickUpper, considerPoolLiquidity) {
    let poolPrice = await LPManager.getPoolPrice(positionId);
    let priceLower = await LPManager.getPriceFromTick(newTickLower);
    let priceUpper = await LPManager.getPriceFromTick(newTickUpper);
    let minted = await getMintedAmounts(LPManager, amount0, amount1, poolPrice, priceLower, priceUpper);
    let midPrice = await LPManager.getPoolPriceWithDecimals(positionId, token0Decimals, token1Decimals);

    let mintLiquidity = await LPManager["getLiquidityForAmounts(uint256,uint256,uint256)"](minted[0], minted[1], positionId);
    let poolLiquidity = await LPManager.getPoolLiquidity(positionId);
    let liquidityRatio = mintLiquidity.mul(bn(10).pow(18)).div(poolLiquidity);

    // n - swap amt, x - amount 0 to mint, y - amount 1 to mint,
    // z - amount 0 minted, t - amount 1 minted, p0 - pool mid price
    // l - liquidity ratio (current mint liquidity vs total pool liq)
    // (X - n) / (Y + n * p0) = (Z + l * n) / (T - l * n * p0) ->
    // n = (X * T - Y * Z) / (p0 * l * X + p0 * Z + l * Y + T)
    
    let denominator;
    if(considerPoolLiquidity) {
        // with liquidity ratio
        denominator = amount0.mul(liquidityRatio).mul(midPrice).div(bn(10).pow(18)).div(1e12).
                        add(midPrice.mul(minted[0]).div(1e12)).
                        add(liquidityRatio.mul(amount1).div(bn(10).pow(18))).
                        add(minted[1]);
    } else {
        // without liquidity ratio
        denominator = (amount0.mul(midPrice).div(1e12)).
                            add(midPrice.mul(minted[0]).div(1e12)).
                            add(amount1).
                            add(minted[1]);
    }

    let a = amount0.mul(minted[1]).div(denominator);
    let b = amount1.mul(minted[0]).div(denominator);
    let swapAmount = a.gte(b) ? a.sub(b) : (b.sub(a)).mul(midPrice).div(1e12);
    let swapSign = a.gte(b) ? true : false;

    return [swapAmount, swapSign];
}

/**
 * Get one inch calldata for swap
 * @param lpSwapperAddress address of the lp swapper
 * @param network network name
 * @param swapAmount amount to be swapped
 * @param t0Address token0 details
 * @param t1Address token1 details
 * @param _0for1 swap t0 for t1 or t1 for t0
 */
 async function getOneInchCalldata(lpSwapperAddress, network: String, swapAmount: String, t0Address: string, t1Address: string, _0for1: boolean) {
    await setBalance(lpSwapperAddress);
    let networkId = getNetworkId(network);
    let oneInchData;
    if(_0for1) {
        let apiUrl = `https://api.1inch.exchange/v4.0/${networkId}/swap?fromTokenAddress=${t0Address}&toTokenAddress=${t1Address}&amount=${swapAmount}&fromAddress=${lpSwapperAddress}&slippage=50&disableEstimate=true`;
        let response = await axios.get(apiUrl);
        oneInchData = response.data.tx.data;
    } else {
        let apiUrl = `https://api.1inch.exchange/v4.0/${networkId}/swap?fromTokenAddress=${t1Address}&toTokenAddress=${t0Address}&amount=${swapAmount}&fromAddress=${lpSwapperAddress}&slippage=50&disableEstimate=true`;
        let response = await axios.get(apiUrl);
        oneInchData = response.data.tx.data;
    }
    return oneInchData;
}


/**
 * Get a network's id by name
 * @param network 
 * @returns 
 */
 function getNetworkId(network) {
    let networkToId = {
        'mainnet': 1,
        'optimism': 10,
        'polygon': 137,
        'arbitrum': 42161
    }
    return networkToId[network];
}

// try to parse a user entered amount for a given token
function tryParseAmount(value?: string, currency?: Currency): CurrencyAmount | undefined {
    if (!value || !currency) {
      return undefined
    }
    try {
      const typedValueParsed = parseUnits(value, currency.decimals).toString()
      if (typedValueParsed !== '0') {
        return currency instanceof Token
          ? new TokenAmount(currency, JSBI.BigInt(Number(typedValueParsed)))
          : CurrencyAmount.ether(JSBI.BigInt(typedValueParsed))
      }
    } catch (error) {
      // should fail if the user specifies too many decimal places of precision (or maybe exceed max uint?)
      console.debug(`Failed to parse input amount: "${value}"`, error)
    }
    // necessary for all paths to return a value
    return undefined
}

function tryParseTick(
  baseToken?: Token,
  quoteToken?: Token,
  feeAmount?: FeeAmount,
  value?: string
): number | undefined {
  if (!baseToken || !quoteToken || !feeAmount || !value) {
    return undefined
  }

  const amount = tryParseAmount(value, quoteToken)

  const amountOne = tryParseAmount('1', baseToken)

  if (!amount || !amountOne) return undefined

  // parse the typed value into a price
  const price = new Price(baseToken, quoteToken, amountOne.raw, amount.raw)

  // this function is agnostic to the base, will always return the correct tick
  const tick = priceToClosestTick(price)

  return nearestUsableTick(tick, TICK_SPACINGS[feeAmount])
}

/**
 * Get pool ticks and prices from price bounds
 * Ticks and prices depend on the tick spacing
 * @param lowerPrice lower price bound
 * @param upperPrice upper price bound
 * @param t0Address token 0 address
 * @param t1Address token 1 address
 * @param t0Decimals token 0 decimals
 * @param t1Decimals token 1 decimals
 * @param feeAmount pool fee amount
 */
function getTicksFromPrices(lowerPrice: string, upperPrice: string, t0Address, t1Address, t0Decimals, t1Decimals, feeAmount) {
    let chainId = ChainId.MAINNET;
    let token0 = new Token(chainId, t0Address, t0Decimals, 'RND', 'RND');
    let token1 = new Token(chainId, t1Address, t1Decimals, 'RND', 'RND');

    let tickLower = tryParseTick(token0, token1, feeAmount, lowerPrice);
    let tickUpper = tryParseTick(token0, token1, feeAmount, upperPrice);

    let priceLower = tickToPrice(token0, token1, tickLower);
    let priceUpper = tickToPrice(token0, token1, tickUpper);

    return {
      priceLower: priceLower.toFixed(4),
      priceUpper: priceUpper.toFixed(4),
      tickLower: tickLower,
      tickUpper: tickUpper
    }
}

/**
 * Get price range from lower and upper ticks
 * @param tickLower lower tick
 * @param tickUpper upper tick
 * @param _token0 token 0 details object
 * @param _token1 token 1 details object
 */
function getPriceFromTicks(tickLower: number, tickUpper: number, _token0, _token1) {
  let chainId = ChainId.MAINNET;
  let token0 = new Token(chainId, _token0.address, _token0.decimals, _token0.symbol, _token0.name);
  let token1 = new Token(chainId, _token1.address, _token1.decimals, _token1.symbol, _token1.name);

  let priceLower = tickToPrice(token0, token1, tickLower);
  let priceUpper = tickToPrice(token0, token1, tickUpper);

  return {
    priceLower: priceLower,
    priceUpper: priceUpper
  }
}

/**
 * Conver a price from number format to Uniswap V3 format (X96) 
 * @param price 
 * @param token0Decimals 
 * @param token1Decimals 
 */
function getPriceInX96(price, token0Decimals, token1Decimals) {
  let chainId = ChainId.MAINNET;
  let token0 = new Token(chainId, '0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9', token0Decimals, 'AAVE', 'AAVE');
  let token1 = new Token(chainId, '0x80dc468671316e50d4e9023d3db38d3105c1c146', token1Decimals, 'xAAVEa', 'xAAVEa');
  let feeAmount = FeeAmount.MEDIUM;

  let tick = tryParseTick(token0, token1, feeAmount, price);
  let _price = tickToPrice(token0, token1, tick);
  let priceInX96 = encodeSqrtRatioX96(_price.raw.numerator, _price.raw.denominator);
  console.log('price', price, ':', priceInX96.toString());
}

/**
 * Set an address ETH balance to 10
 * @param {*} address 
 */
 async function setBalance(address) {
    await network.provider.send("hardhat_setBalance", [
      address,
      bnDecimal(10).toHexString(),
    ]);
  }

async function oneInchSwapCLR(CLR, swapAmount, token0, token1, _0for1) {
    await setBalance(CLR.address);
    if(_0for1) {
        let apiUrl = `https://api.1inch.exchange/v3.0/1/swap?fromTokenAddress=${token0.address}&toTokenAddress=${token1.address}&amount=${swapAmount}&fromAddress=${CLR.address}&slippage=50&disableEstimate=true`;
        let response = await axios.get(apiUrl);
        let oneInchData = response.data.tx.data;
        console.log('one inch response:', response.data);
        await CLR.adminSwapOneInch(1, true, oneInchData);
    } else {
        let apiUrl = `https://api.1inch.exchange/v3.0/1/swap?fromTokenAddress=${token1.address}&toTokenAddress=${token0.address}&amount=${swapAmount}&fromAddress=${CLR.address}&slippage=50&disableEstimate=true`;
        let response = await axios.get(apiUrl);
        let oneInchData = response.data.tx.data;
        await CLR.adminSwapOneInch(1, false, oneInchData);
    }
}

/**
 * Swap using one inch exchange
 * @param {*} account Account to swap with
 * @param {*} token0 Token 0 for swapping
 * @param {*} token1 Token 1 for swapping
 * @param {*} amount Amount to swap
 * @param {*} _0for1 Swap token 0 for token 1 if true
 */
async function oneInchSwap(account, amount, token0, token1, _0for1) {
    let oneInchAddress = '0x11111112542D85B3EF69AE05771c2dCCff4fAa26';
    if(_0for1) {
        await token0.approve(oneInchAddress, bnDecimal(100000000));
        let token0Decimals = await token0.decimals();
        let swapAmount = bnDecimals(amount, token0Decimals);
        let apiUrl = `https://api.1inch.exchange/v3.0/1/swap?fromTokenAddress=${token0.address}&toTokenAddress=${token1.address}&amount=${swapAmount}&fromAddress=${account.address}&slippage=50&disableEstimate=true`;
        let response = await axios.get(apiUrl);
        let oneInchData = response.data.tx.data;
        let tx = {
            from: account.address,
            to: oneInchAddress,
            data: oneInchData
        }
        await account.sendTransaction(tx);
    } else {
        await token1.approve(oneInchAddress, bnDecimal(100000000));
        let token1Decimals = await token1.decimals();
        let swapAmount = bnDecimals(amount, token1Decimals);
        let apiUrl = `https://api.1inch.exchange/v3.0/1/swap?fromTokenAddress=${token1.address}&toTokenAddress=${token0.address}&amount=${swapAmount}&fromAddress=${account.address}&slippage=50&disableEstimate=true`;
        let response = await axios.get(apiUrl);
        let oneInchData = response.data.tx.data;
        let tx = {
            from: account.address,
            to: oneInchAddress,
            data: oneInchData
        }
        await account.sendTransaction(tx);
    }
}

async function receiveXTK(receiverAccount) {
    let xtkAddress = '0x7f3edcdd180dbe4819bd98fee8929b5cedb3adeb';
    let accountWithXTK = '0x38138586aedb29b436eab16105b09c317f5a79dd';
    await receiveToken(receiverAccount, accountWithXTK, xtkAddress, bnDecimal(2000000));

    // get balance by unstaking xtk from staking module with biggest whale there
    const anotherAccountWithXTK = '0xa0f75491720835b36edc92d06ddc468d201e9b73';
    const stakingModule = '0x314022e24ced941781dc295682634b37bd0d9cfc'
    let staking = await ethers.getContractAt('IxStaking', stakingModule);
    const signer = await impersonate(anotherAccountWithXTK);
    const xxtkaAmount = bnDecimal(50000000);
    await staking.connect(signer).unstake(xxtkaAmount);
    const token = await ethers.getContractAt('IERC20', xtkAddress);
    let newAccountBalance = await token.balanceOf(anotherAccountWithXTK);

    // 6M xtoken
    await token.connect(signer).transfer(receiverAccount.address, newAccountBalance);
}

async function receiveWeth(receiverAccount) {
    let wethAddress = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2'
    let accountWithWeth = '0xe78388b4ce79068e89bf8aa7f218ef6b9ab0e9d0'
    await receiveToken(receiverAccount, accountWithWeth, wethAddress, bnDecimal(50000));
}

/**
 * Receive 1M USDT from OKEx official exchange address
 * To be used on mainnet forks
 * @param receiverAccount 
 */
async function receiveUSDT(receiverAccount) {
    let usdtAddress = '0xdAC17F958D2ee523a2206206994597C13D831ec7'
    let accountWithUSDT = '0x5041ed759Dd4aFc3a72b8192C143F72f4724081A'
    await receiveToken(receiverAccount, accountWithUSDT, usdtAddress, bnDecimals(1000000, 6));
}

/**
 * Receive 1M USDC from Circle address
 * To be used on mainnet forks
 * @param receiverAccount 
 */
async function receiveUSDC(receiverAccount) {
    let usdcAddress = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
    let accountWithUSDC = '0x55fe002aeff02f77364de339a1292923a15844b8'
    await receiveToken(receiverAccount, accountWithUSDC, usdcAddress, bnDecimals(1000000, 6));
}

/**
 * Get mainnet tokens as ERC20 contracts
 * @returns 
 */
async function getTokens() {
    let usdtAddress = '0xdAC17F958D2ee523a2206206994597C13D831ec7'
    let usdcAddress = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
    let usdt: ERC20 = <ERC20>await ethers.getContractAt('ERC20', usdtAddress)
    let usdc: ERC20 = <ERC20>await ethers.getContractAt('ERC20', usdcAddress)
    return {
        usdt: usdt,
        usdc: usdc
    }
}

/**
 * Receive a token using an impersonated account
 * @param {hre.ethers.signer} receiverAccount - Signer of account to receive tokens
 * @param {String} accountToImpersonate - address
 * @param {String} token - token address
 * @param {String} amount - amount to send
 */
async function receiveToken(receiverAccount, accountToImpersonate, tokenAddress, amount) {
    // Impersonate account
    await hre.network.provider.request({
        method: "hardhat_impersonateAccount",
        params: [accountToImpersonate]}
    )
    const signer = await ethers.getSigner(accountToImpersonate)
    // Send tokens to account
    let ethSendTx = {
        to: accountToImpersonate,
        value: bnDecimal(6)
    }
    await receiverAccount.sendTransaction(ethSendTx);
    const token = await ethers.getContractAt('IERC20', tokenAddress);
    await token.connect(signer).transfer(receiverAccount.address, amount);
}

/**
 * Receive tokens using an impersonated account
 * @param {hre.ethers.signer} receiverAccount - Signer of account to receive tokens
 * @param {String} accountToImpersonate - address
 * @param {Map} tokens - map of token address to amount to receive of that token
 */
async function receiveTokens(receiverAccount, accountToImpersonate, tokens) {
    // Impersonate account
    await hre.network.provider.request({
        method: "hardhat_impersonateAccount",
        params: [accountToImpersonate]}
    )
    const signer = await ethers.getSigner(accountToImpersonate)
    // Send tokens to account
    let ethSendTx = {
        to: accountToImpersonate,
        value: bnDecimal(1)
    }
    // console.log('sending eth to account:', accountToImpersonate)
    await receiverAccount.sendTransaction(ethSendTx);
    for(let [address, amount] of Object.entries(tokens)) {
        const token = await ethers.getContractAt('IERC20', address);
        await token.connect(signer).transfer(receiverAccount.address, amount)
    }
}

async function impersonate(address) {
    await setBalance(address);
    await hre.network.provider.request({
        method: "hardhat_impersonateAccount",
        params: [address]}
    )
    return await ethers.getSigner(address)
}

/**
 * Get token 0 ratio in position in %
 * @param {Contract} uniswapLibrary 
 * @param {Contract} CLR 
 * @param {String} poolAddress 
 * @returns 
 */
 async function getPositionTokenRatio(uniswapLibrary, CLR, poolAddress) {
    let position = await CLR.getStakedTokenBalance();
    let midPrice = await getMidPrice(uniswapLibrary, poolAddress);
    let token0AmountProper = position.amount0.mul(midPrice).div(1e12);
    let ratio = (token0AmountProper.mul(1e4).div(position.amount1).toNumber() / 1e4) * 100;
    ratio = ratio.toFixed(2);
    let ratioSum = new Number(ratio) + 100;
    let actualRatio = new Number(((ratio / ratioSum) * 100).toFixed(2));
    return actualRatio;
}

/**
 * Print token ratios in position
 * @param {Contract} uniswapLibrary 
 * @param {Contract} CLR 
 * @param {String} poolAddress 
 */
async function printPositionTokenRatios(uniswapLibrary, CLR, poolAddress) {
    let position = await CLR.getStakedTokenBalance();
    let midPrice = await getMidPrice(uniswapLibrary, poolAddress);
    let token0AmountProper = position.amount0.mul(midPrice).div(1e12);
    let ratio = (token0AmountProper.mul(1e4).div(position.amount1).toNumber() / 1e4) * 100;
    ratio = ratio.toFixed(2);
    let ratioSum = new Number(ratio) + 100;
    let actualRatio = new Number(((ratio / ratioSum) * 100).toFixed(2));
    console.log('token 0 : token 1 amount ratio:', actualRatio.toString(), ':', 100 - actualRatio);
}

/**
 * Get pool mid price using uniswap library
 * @param {Contract} uniswapLibrary 
 * @param {String} poolAddress 
 * @returns {BigNumber}
 */
async function getMidPrice(uniswapLibrary, poolAddress) {
    let midPrice = await uniswapLibrary.getPoolPriceWithDecimals(poolAddress);
    return midPrice;
}

/**
 * Get upper and lower price bounds for xAAVEa
 * upper price bound = mid price * 104%
 * Used for AAVE-xAAVEa CLR instance
 * @param {Contract} uniswapLibrary 
 * @param {String} poolAddress 
 * @returns 
 */
async function getPriceBounds(uniswapLibrary, poolAddress) {
    let midPrice = await getMidPrice(uniswapLibrary, poolAddress);
    midPrice = midPrice.div(1e8).toNumber() / 1e4;
    let sqrtMidPrice = Math.sqrt(midPrice);
    let c = Math.sqrt(1.04); // upper bound / mid price
    // goal is to have 40:60 token ratio for AAVE:xAAVEa
    // amount 1 = amount 0 * mid_price * 3/2
    let y = midPrice * (3/2);
    // a = (c p^2 x - c y + y)/(c p x), solve for a^2
    // a - lower price bound, c - sqrt(upper bound / mid price), p = sqrt(mid price)
    // x - amount 0, y = amount 1
    let lowerBound = (c * (Math.pow(sqrtMidPrice, 2)) - c * y + y) / (c * sqrtMidPrice);
    return [(Math.pow(lowerBound, 2)).toFixed(4), midPrice + midPrice * (4 / 100)];
}

/**
 * Print pool mid price using uniswap library
 * @param {Contract} uniswapLibrary 
 * @param {String} poolAddress 
 */
async function printMidPrice(uniswapLibrary, poolAddress) {
    let midPrice = await uniswapLibrary.getPoolPriceWithDecimals(poolAddress);
    console.log('MID PRICE:', (midPrice.toNumber() / 1e12).toFixed(8));
}


/**
 * Get amounts minted with both tokens
 * @param {Contract} LPManager Contract instance
 * @param {BigNumber} amount0 token 0 amount
 * @param {BigNumber} amount1 token 1 amount
 * @returns 
 */
async function getMintedAmounts(LPManager: UniswapPositionManager, amount0, amount1, poolPrice, priceLower, priceUpper) {
    let amountsMinted = await LPManager.calculatePoolMintedAmounts(amount0, amount1, poolPrice, priceLower, priceUpper);
    return [amountsMinted.amount0Minted.toString(), amountsMinted.amount1Minted.toString()];
}

/**
 * Get amounts minted with one token
 * @param {Contract} CLR Contract instance
 * @param {Number} inputAsset 0 for token 0, 1 for token 1
 * @param {BigNumber} amount minimum amount of token *inputAsset* to mint with
 * @returns 
 */
async function getSingleTokenMintedAmounts(CLR, inputAsset, amount) {
    let amountsMinted = await CLR.calculateAmountsMintedSingleToken(inputAsset, amount);
    return [amountsMinted.amount0Minted, amountsMinted.amount1Minted];
}

/**
 * Get token balance of an address
 */
async function getTokenBalance(token, address) {
    let balance = await token.balanceOf(address);
    return balance;
}

/**
 * Get position balance
 * @param CLR CLR contract
 * @returns 
 */
async function getPositionBalance(CLR) {
    let tokenBalance = await CLR.getStakedTokenBalance();
    return [getNumberNoDecimals(tokenBalance.amount0),
            getNumberNoDecimals(tokenBalance.amount1)];
}

/**
 * Get buffer balance
 * @param CLR CLR contract
 * @returns 
 */
 async function getBufferBalance(CLR) {
    let tokenBalance = await CLR.getBufferTokenBalance();
    return [(tokenBalance.amount0),
            (tokenBalance.amount1)];
}

/**
 * Print the current pool position and CLR (buffer) token balances
 * @param CLR CLR contract
 */
async function printPositionAndBufferBalance(CLR) {
    let bufferBalance = await getBufferBalance(CLR);
    let positionBalance = await getPositionBalance(CLR);
    console.log('CLR balance:\n' + 'token0:', getNumberNoDecimals(bufferBalance[0]), 'token1:', getNumberNoDecimals(bufferBalance[1]));
    console.log('position balance:\n' + 'token0:', positionBalance[0], 'token1:', positionBalance[1]);
}

/**
 * Print the buffer:pool token ratio
 * @param CLR CLR contract
 */
async function getRatio(CLR) {
    let bufferBalance = await CLR.getBufferBalance();
    let poolBalance = await CLR.getStakedBalance();
    console.log('buffer balance:', getNumberNoDecimals(bufferBalance));
    console.log('position balance:', getNumberNoDecimals(poolBalance));

    let contractPoolTokenRatio = (getNumberNoDecimals(bufferBalance) + getNumberNoDecimals(poolBalance)) / 
                                  getNumberNoDecimals(bufferBalance);
    
    console.log('CLR : pool token ratio:', (100 / contractPoolTokenRatio.toFixed(2)).toFixed(2) + '%');
}

/**
 * Get the buffer:staked token ratio
 * @param CLR CLR contract
 */
 async function getBufferPositionRatio(CLR) {
    let bufferBalance = await CLR.getBufferBalance();
    let poolBalance = await CLR.getStakedBalance();

    let contractPoolTokenRatio = (getNumberNoDecimals(bufferBalance) + getNumberNoDecimals(poolBalance)) / 
                                  getNumberNoDecimals(bufferBalance);
    
    return (100 / contractPoolTokenRatio).toFixed(1);
}

/**
 * Get calculated twaps of token0 and token1
 * @param CLR CLR contract
 */
async function getTokenPrices(CLR) {
    // Increase time by 1 hour = 3600 seconds to get previous price
    await network.provider.send("evm_increaseTime", [300]);
    await network.provider.send("evm_mine");
    // Get asset 0 price
    let asset0Price = await CLR.getAsset0Price();
    let twap0 = getTWAP(asset0Price);
    console.log('twap token0:', twap0);
    // Get Asset 1 Price
    let asset1Price = await CLR.getAsset1Price();
    let twap1 = getTWAP(asset1Price);
    console.log('twap token1:', twap1);
    return {
        asset0: twap0,
        asset1: twap1
    }
}

function getMinPrice() {
    return '4295128740'
}

function getMaxPrice() {
    return '1461446703485210103287273052203988822378723970341';
}

function getMinTick() {
    return -887273;
}

function getMaxTick() {
    return 887271;
}

async function swapToken0ForToken1Mainnet(token0, token1, swapperAddress, amount) {
    const router = (await getUniswapInstances()).router;
    await swapToken0ForToken1(router, token0, token1, swapperAddress, amount);
}

async function swapToken1ForToken0Mainnet(token0, token1, swapperAddress, amount) {
    const router = (await getUniswapInstances()).router;
    await swapToken1ForToken0(router, token0, token1, swapperAddress, amount);
}

async function swapToken0ForToken1(router, token0, token1, swapperAddress, amount) {
    const pendingBlock = await network.provider.send("eth_getBlockByNumber", ["pending", false])
    const timestamp = pendingBlock.timestamp + 10000;

    await router.exactInputSingle({
        tokenIn: token0.address,
        tokenOut: token1.address,
        fee: 3000,
        recipient: swapperAddress,
        deadline: timestamp,
        amountIn: amount,
        amountOutMinimum: 0,
        sqrtPriceLimitX96: 0
      });
}

async function swapToken1ForToken0(router, token0, token1, swapperAddress, amount) {
    const pendingBlock = await network.provider.send("eth_getBlockByNumber", ["pending", false])
    const timestamp = pendingBlock.timestamp + 10000;

    await router.exactInputSingle({
        tokenIn: token1.address,
        tokenOut: token0.address,
        fee: 3000,
        recipient: swapperAddress,
        deadline: timestamp,
        amountIn: amount,
        amountOutMinimum: 0,
        sqrtPriceLimitX96: 0
    });
}

/**
 * Swap token 0 for token 1 using Uniswap Router, considering token decimals when swapping
 */
async function swapToken0ForToken1Decimals(router, token0, token1, swapperAddress, amount) {
    let token0Decimals = await token0.decimals();
    let lowPrice = getMinPrice();
    const pendingBlock = await network.provider.send("eth_getBlockByNumber", ["pending", false])
    const timestamp = pendingBlock.timestamp + 10000;
    // tokens should be in precise decimal representation before swapping
    let amountIn = amount.div(bn(10).pow(18 - token0Decimals));

    await router.exactInputSingle({
        tokenIn: token0.address,
        tokenOut: token1.address,
        fee: 3000,
        recipient: swapperAddress,
        deadline: timestamp,
        amountIn: amountIn,
        amountOutMinimum: 0,
        sqrtPriceLimitX96: lowPrice
      });
}

/**
 * Swap token 1 for token 0 using Uniswap Router, considering token decimals when swapping
 */
async function swapToken1ForToken0Decimals(router, token0, token1, swapperAddress, amount) {
    let token1Decimals = await token1.decimals();
    let highPrice = getMaxPrice();
    const pendingBlock = await network.provider.send("eth_getBlockByNumber", ["pending", false])
    const timestamp = pendingBlock.timestamp + 10000;

    // tokens should be in precise decimal representation before swapping
    let amountIn = amount.div(bn(10).pow(18 - token1Decimals));

    await router.exactInputSingle({
        tokenIn: token1.address,
        tokenOut: token0.address,
        fee: 3000,
        recipient: swapperAddress,
        deadline: timestamp,
        amountIn: amountIn,
        amountOutMinimum: 0,
        sqrtPriceLimitX96: highPrice
    });
}

/**
 * Get event details from a transaction
 */
async function getEvent(tx, eventName) {
  let receipt = await tx.wait();
  let event = receipt.events.filter(e => e.event == eventName);
  return event[0];
}

/**
 * Get new position token id from a reposition tx
 */
async function getNewPositionId(tx) {
    let event = await getEvent(tx, 'Repositioned');
    let positionId = event.args.newPositionId;
    return positionId;
}

/**
 * Get ETH Balance of contract
 * @param {ethers.Contract} contract 
 */
async function getBalance(contract) {
    return await contract.provider.getBalance(contract.address);
}

/**
 * Get latest block timestamp
 * @returns current block timestamp
 */
async function getBlockTimestamp() {
    const latestBlock = await network.provider.send("eth_getBlockByNumber", ["latest", false]);
    return hre.web3.utils.hexToNumber(latestBlock.timestamp);
}

/**
 * Increase time in Hardhat Network
 */
async function increaseTime(time) {
    await network.provider.send("evm_increaseTime", [time]);
    await network.provider.send("evm_mine");
}

/**
 * Decrease time in Hardhat Network
 */
async function decreaseTime(seconds) {
    await network.provider.send("evm_increaseTime", [-seconds]);
    await network.provider.send("evm_mine");
}

/**
 * Mine several blocks in network
 * @param {Number} blockCount how many blocks to mine
 */
async function mineBlocks(blockCount) {
    for(let i = 0 ; i < blockCount ; ++i) {
        await network.provider.send("evm_mine");
    }
}

/**
 * Activate or disactivate automine in hardhat network
 * @param {Boolean} active 
 */
async function setAutomine(active) {
    await network.provider.send("evm_setAutomine", [active]);
}

async function getLastBlock() {
    return await network.provider.send("eth_getBlockByNumber", ["latest", false]);
}

async function getLastBlockTimestamp() {
    let block = await getLastBlock();
    return block.timestamp;
}

/**
 * Change current fork for hardhat network
 * @param network 
 * @returns 
 */
 async function resetFork(network) {
    let url;
    const env = process.env;
    const key = env.ALCHEMY_KEY;
    const alchemy = {
        mainnet: 'https://eth-mainnet.alchemyapi.io/v2/',
        arbitrum: 'https://arb-mainnet.g.alchemy.com/v2/',
        optimism: 'https://opt-mainnet.g.alchemy.com/v2/',
        polygon: 'https://polygon-mainnet.g.alchemy.com/v2/',
        kovan: 'https://eth-kovan.alchemyapi.io/v2/'
    }
    switch(network) {
        case 'mainnet':
            url = alchemy['mainnet'] + key;
            break;
        case 'arbitrum':
            url = alchemy['arbitrum'] + key;
            break;
        case 'optimism':
            url = alchemy['optimism'] + key;
            break;
        case 'polygon':
            url = alchemy['polygon'] + key;
            break;
        default:
            console.log('invalid network');
            return;
    }
    await network.provider.request({
        method: "hardhat_reset",
        params: [
          {
            forking: {
              jsonRpcUrl: url
            }
          }
        ]
      });
}

async function verifyContractNoArgs(address) {
    try {
        await hre.run("verify:verify", {
            address: address,
            constructorArguments: [],
        });
    } catch (err) {
        console.log('error while verifying contract:', err);
    }
}

async function verifyContractWithArgs(address, ...args) {
    try {
        await hre.run("verify:verify", {
            address: address,
            constructorArguments: [...args],
        });
    } catch (err) {
        console.log('error while verifying contract:', err);
    }
}

async function verifyContractWithArgsAndName(address, contractName, ...args) {
    try {
        await hre.run("verify:verify", {
            address: address,
            contract: contractName,
            constructorArguments: [...args],
        });
    } catch (err) {
        console.log('error while verifying contract:', err);
    }
}

/**
 * Return actual twap from ABDK 64.64 representation
 * Used with getAsset0Price()
 */
function getTWAP(twap) {
    twap = twap.mul(1e8).div(bn(2).pow(bn(64)));
    return twap.toNumber() / 1e8;
}

/**
 * Return actual twap from ABDK 64.64 representation
 * With 18 decimals
 */
 function getTWAPDecimals(twap) {
    twap = twap.mul(bn(10).pow(18)).div(bn(2).pow(bn(64)));
    return twap;
}

/**
 * Get pool mid price in normal terms for readability
 * @param {Contract} uniswapLibrary UniswapLibrary instance
 * @param {String} poolAddress Address of pool for price reading
 * @returns 
 */
async function getPoolMidPrice(uniswapLibrary, poolAddress) {
    let poolPrice = await uniswapLibrary.getPoolPriceWithDecimals(poolAddress);
    return poolPrice.div(1e8).toNumber() / 1e4;
}

/**
 * Get pool price in normal terms for readability
 * @param {BigNumber} poolPrice price in X64.96 format
 * @returns 
 */
function getPoolPriceInNumberFormat(poolPrice) {
    return poolPrice.pow(2).mul(1e8).shr(96 * 2).toNumber() / 1e8
}

/**
 * Get sqrt of a BigNumber
 * @param {BigNumber} value 
 * @returns 
 */
function sqrt(value) {
    const ONE = bn(1);
    const TWO = bn(2);
    let x = bn(value);
    let z = x.add(ONE).div(TWO);
    let y = x;
    while (z.sub(y).isNegative()) {
        y = z;
        z = x.div(z).add(z).div(TWO);
    }
    return y;
}

/**
 * Return BigNumber
 */
function bn(amount) {
    return ethers.BigNumber.from(amount);
}

/**
 * Returns bignumber scaled to 18 decimals
 */
function bnDecimal(amount) {
    let decimal = Math.pow(10, 18);
    let decimals = bn(decimal.toString());
    return bn(amount).mul(decimals);
}

/**
 * Returns bignumber scaled to custom amount of decimals
 */
 function bnDecimals(amount, _decimals) {
    let decimal = Math.pow(10, _decimals);
    let decimals = bn(decimal.toString());
    return bn(amount).mul(decimals);
}

/**
 * Returns number representing BigNumber without decimal precision
 */
function getNumberNoDecimals(amount) {
    let decimal = Math.pow(10, 18);
    let decimals = bn(decimal.toString());
    return amount.div(decimals).toNumber();
}

function gnnd(amount) {
    return getNumberNoDecimals(bn(amount));
}

function gnn8d(amount) {
    return amount.div(1e10).toNumber() / 1e8;
}

/**
 * Returns number representing BigNumber without decimal precision (custom)
 */
 function getNumberDivDecimals(amount, _decimals) {
    let decimal = Math.pow(10, _decimals);
    let decimals = bn(decimal.toString());
    return amount.div(decimals).toNumber();
}

export {
    deploy, deployArgs, deployWithAbi, deployAndLink, deployWithAbiAndLink, getTWAP,
    getRatio, getTokenPrices, getMinPrice, getMaxPrice, getMinTick, getMaxTick,
    getTokenBalance, getPositionBalance, getBufferBalance, printPositionAndBufferBalance,
    bn, bnDecimal, bnDecimals, getNumberNoDecimals, getNumberDivDecimals, 
    getBlockTimestamp, swapToken0ForToken1, swapToken1ForToken0,
    swapToken0ForToken1Decimals, swapToken1ForToken0Decimals, getPoolPriceInNumberFormat,
    increaseTime, mineBlocks, getBufferPositionRatio, getMintedAmounts,
    getSingleTokenMintedAmounts, gnnd, gnn8d, getPoolMidPrice,
    getTWAPDecimals, getRepositionSwapAmount, getMidPrice, printMidPrice,
    getPositionTokenRatio, printPositionTokenRatios, getPriceBounds,
    getBalance, setAutomine, getLastBlock, 
    getLastBlockTimestamp, decreaseTime, getEvent, getNewPositionId,
    getTicksFromPrices, getPriceFromTicks, getPriceInX96,
    // mainnet fork functions
    impersonate, swapToken0ForToken1Mainnet, swapToken1ForToken0Mainnet,
    receiveXTK, receiveWeth, receiveUSDC, receiveUSDT, resetFork,
    depositLiquidityInPool, oneInchSwap, oneInchSwapCLR, getTokens,
    verifyContractNoArgs, verifyContractWithArgs, verifyContractWithArgsAndName,
    getOneInchCalldata
}