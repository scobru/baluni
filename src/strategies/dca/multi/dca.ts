import {initializeWallet} from '../../../utils/web3/dexWallet';
import {invest} from '../../investor/execute';
import {loadPrettyConsole} from '../../../utils/prettyConsole';
import {NETWORKS, USDC} from 'baluni-api';
import * as config from './config';

const prettyConsole = loadPrettyConsole();

// DCA configuration
// the amount in USDC for each investment

async function dca() {
  try {
    const dexWallet = await initializeWallet(
      String(NETWORKS[config?.SELECTED_CHAINID])
    );
    // Initialize your DexWallet here

    // DCA Mechanism - periodically invest
    const investDCA = async () => {
      try {
        await invest(
          dexWallet,
          config?.WEIGHTS_UP as any,
          String(USDC[config?.SELECTED_CHAINID]),
          config?.TOKENS as any,
          false,
          String(config?.INVESTMENT_AMOUNT),
          config?.SELECTED_PROTOCOL,
          NETWORKS[config?.SELECTED_CHAINID],
          Number(config?.SLIPPAGE)
        );
        prettyConsole.log('Invested part of funds, continuing DCA');
      } catch (error) {
        prettyConsole.error('Error during DCA investment:', error);
      }
    };

    // Initial investment
    await investDCA();

    // Schedule further investments
    setInterval(async () => {
      await investDCA();
    }, config?.INVESTMENT_INTERVAL);
  } catch (error) {
    prettyConsole.error('Error during initialization:', error);
  }
}

async function main() {
  await dca();
  prettyConsole.log('DCA Rebalancer operation started');
}

main().catch(error => {
  prettyConsole.error('An error occurred:', error);
});
