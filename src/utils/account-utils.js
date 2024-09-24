import { Wallet, ethers } from "ethers";
import { encrypt } from "./encryption-utils";

// Function to generate an account
export function generateAccount(seedPhrase = "", index = 0) {
  let wallet;

  // If the seed phrase is not provided, generate a random mnemonic
  if (seedPhrase === "") {
    seedPhrase = Wallet.createRandom().mnemonic.phrase;
  }

  // If the seed phrase does not contain spaces, it is likely a private key
  wallet = seedPhrase.includes(" ")
    ? Wallet.fromMnemonic(seedPhrase, `m/44'/60'/0'/0/${index}`)
    : new Wallet(seedPhrase);

  return {
    address: wallet.address,
    privateKey: encrypt(wallet.privateKey),
    mnemonic: encrypt(seedPhrase),
  };
}

// Function to get balance
export async function getBalance(rpcUrl, address) {
  const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
  const balance = await provider.getBalance(address);
  return Number(formatEther(balance));
}

// Function to format balance
export function formatBalance(value, decimalPlaces = 3) {
  const formattedBalance = +parseFloat(value).toFixed(decimalPlaces);

  if (formattedBalance < 0.001) {
    return +value;
  }

  return formattedBalance;
}

// Function to format Ether value
export function formatEther(value) {
  return ethers.utils.formatEther(value ?? 0);
}

export default {
  generateAccount,
  getBalance,
  formatBalance,
  formatEther,
};
