import { Wallet, ethers, Contract } from "ethers";
import { CHAIN, RAFFLE_ABI, RAFFLE_CONTRACT } from "../config";
import { getWalletByAddress } from "./bot-utils";
import { decrypt } from "./encryption-utils";
import Raffle from "../models/raffle";

const alchemySepoliaURL = `https://eth-sepolia.g.alchemy.com/v2/${process.env.ALCHEMY_RPC_API_KEY}`;

const sepoliaProvider = new ethers.providers.JsonRpcProvider(alchemySepoliaURL);

const contract = new ethers.Contract(
  RAFFLE_CONTRACT,
  RAFFLE_ABI,
  sepoliaProvider
);
export async function getRaffleDetails(raffleId) {
  try {
    const details = await contract.getRaffleDetails(raffleId);
    return details;
  } catch (error) {
    console.error(`Error fetching raffle details for ID ${raffleId}:`, error);
  }
}

export async function endRaffle(raffleId) {
  try {
    const details = await contract.endRaffle(raffleId);
    return details;
  } catch (error) {
    console.error(`Error fetching raffle details for ID ${raffleId}:`, error);
  }
}

export async function updateRaffle(
  ctx,
  raffleId,
  newMaxTickets,
  newEndTime,
  newStartTime,
  newMaxBuyPerWallet,
  newTgOwner,
  newTgOwnerPercent
) {
  try {
    const walletAddress = ctx.session.adminWalletAddress;
    const w = getWalletByAddress(ctx, walletAddress);
    const privateKey = decrypt(w.privateKey);
    const wallet = new ethers.Wallet(privateKey, sepoliaProvider);

    const contractWithSigner = new ethers.Contract(
      RAFFLE_CONTRACT,
      RAFFLE_ABI,
      wallet
    );
    const finalMaxTickets =
      newMaxTickets !== null
        ? newMaxTickets
        : ctx.session.raffleDetails.maxTickets;
    const finalEndTime =
      newEndTime !== null
        ? newEndTime
        : ctx.session.raffleDetails.raffleEndTime;
    const finalStartTime =
      newStartTime !== null
        ? newStartTime
        : ctx.session.raffleDetails.raffleStartTime;
    const finalMaxBuyPerWallet =
      newMaxBuyPerWallet !== null
        ? newMaxBuyPerWallet
        : ctx.session.raffleDetails.maxBuyPerWallet;
    const finalTgOwner =
      newTgOwner !== null ? newTgOwner : ctx.session.raffleDetails.tgOwner;
    const finalTgOwnerPercent =
      newTgOwnerPercent !== null
        ? newTgOwnerPercent
        : ctx.session.raffleDetails.tgOwnerPercentage;
    contractWithSigner.on(
      "RaffleUpdated",
      async (
        raffleId,
        admin,
        maxTickets,
        raffleEndTime,
        raffleStartTime,
        maxBuyPerWallet,
        tgOwner,
        tgOwnerPercentage
      ) => {
        if (admin.toLowerCase() === wallet.address.toLowerCase()) {
          const raffleDetails = {
            maxTickets: maxTickets.toNumber(),
            raffleStartTime: raffleStartTime.toNumber(),
            raffleEndTime: raffleEndTime.toNumber(),
            maxBuyPerWallet: maxBuyPerWallet.toNumber(),
            tgOwner: tgOwner,
            tgOwnerPercentage: tgOwnerPercentage.toNumber(),
          };
          try {
            const updatedRaffle = await Raffle.findOneAndUpdate(
              { raffleId: raffleId.toNumber() },
              raffleDetails,
              { new: true }
            );
            if (updatedRaffle) {
              console.log("Raffle updated successfully in the database");
            } else {
              console.error("Failed to update raffle in the database");
            }
          } catch (error) {
            console.error("Error updating raffle in the database:", error);
          }
        }
      }
    );
    const tx = await contractWithSigner.updateRaffle(
      raffleId,
      finalMaxTickets,
      finalEndTime,
      finalStartTime,
      finalMaxBuyPerWallet,
      finalTgOwner,
      finalTgOwnerPercent
    );
    await ctx.reply(`Transaction sent: ${tx.hash}`);
    await ctx.reply(`Your transaction is getting mined, please wait...`);

    const receipt = await tx.wait();

    await ctx.reply(`Transaction mined: ${receipt.transactionHash}`);
    await ctx.reply("Raffle is updated successfully ✨");
  } catch (error) {
    console.error(error);
    ctx.reply("Failed to update the raffle try again");
  }
}
