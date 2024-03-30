import {initializeWallet} from '../../utils/web3/dexWallet'; // Import the initializeWallet function
import {invest} from './execute';
import {loadPrettyConsole} from '../../utils/prettyConsole';
import * as config from './config';
import {USDC, NETWORKS} from 'baluni-api';

const prettyConsole = loadPrettyConsole();

const amount = String(process.argv[3]);
const sellAll = Boolean(process.argv[4]);

async function investor() {
  prettyConsole.log('Sell All?', sellAll);
  try {
    const dexWallet = await initializeWallet(
      String(NETWORKS[config?.SELECTED_CHAINID] as any)
    );

    await invest(
      dexWallet,
      config?.WEIGHTS_UP as any,
      String(USDC[config?.SELECTED_CHAINID]),
      config?.TOKENS as any,
      sellAll,
      amount,
      config?.SELECTED_PROTOCOL,
      config?.SELECTED_CHAINID,
      Number(config?.SLIPPAGE)
    );
    prettyConsole.log('Investing operation completed');
  } catch (error) {
    prettyConsole.error('Error during initialization:', error);
  }
}

async function main() {
  await investor();
  prettyConsole.log('Rebalancer operation started');
}

main().catch(error => {
  prettyConsole.error('An error occurred:', error);
});
