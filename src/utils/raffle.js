import { Wallet, ethers, Contract } from "ethers";
import { CHAIN, RAFFLE_ABI, RAFFLE_cONTRACT } from "../config";
export const createRaffle = async () => {
  const provider = new ethers.providers.JsonRpcProvider(
    CHAIN["sepolia"].rpcUrl
  );
  const wallet = new Wallet(
    "0x7407016d5d3febc0f5704a651e0638180a8de42c679223d9a8e87f3afeba1abc",
    provider
  );

  const contract = new Contract(RAFFLE_cONTRACT, RAFFLE_ABI, wallet);

  const out = await contract.REFERRER_FEE_PERCENTAGE();
  console.log("Contract", out);
};
