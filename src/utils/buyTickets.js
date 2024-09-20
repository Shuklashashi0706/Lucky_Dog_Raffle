import { Wallet, ethers, Contract } from "ethers";
import { CHAIN, RAFFLE_ABI, RAFFLE_CONTRACT } from "../config";


export const buyTickets = async (ctx, privateKey,numberOfTickets) => {
  const provider = new ethers.providers.JsonRpcProvider(
    CHAIN["sepolia"].rpcUrl
  );
  if (!privateKey) {
    ctx.reply(
      "Private key is not defined...just for testing purpose ...remove it"
    );
  }
  const wallet = new Wallet(privateKey, provider);
  const raffleId = 30;
      
  const contract = new Contract(RAFFLE_CONTRACT, RAFFLE_ABI, wallet);

  try {
    await ctx.reply("Your transaction is being processed, please wait...");
    const tx = await contract.buyTickets(
      raffleId,
      numberOfTickets
    );

    // Notify the user of the transaction hash
    await ctx.reply(`Transaction sent: ${tx.hash}`);
    await ctx.reply(`Your transaction is getting mined , please wait.....`);
    const receipt = await tx.wait();
    // Notify the user that the transaction has been mined
    await ctx.reply(`Transaction mined: ${receipt.transactionHash}`);
    await ctx.reply("Raffle is created successfully ✨");


  } catch (error) {
    console.error("Error Buying Tickets:", error);
    if (error.reason) {
      ctx.reply(`Failed to Buy Tickets: ${error.reason}`);
    } else {
      ctx.reply(
        "Failed to Buy Tickets. Please check input parameters and try again."
      );
    }
  }
};
