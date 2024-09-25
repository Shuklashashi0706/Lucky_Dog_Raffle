import { Wallet, ethers, Contract } from "ethers";
import { CHAIN, RAFFLE_ABI, RAFFLE_CONTRACT } from "../config";
import { getWalletByAddress } from "./bot-utils";
import { decrypt } from "./encryption-utils";
import Raffle from "../models/raffle";

const provider = new ethers.providers.JsonRpcProvider(CHAIN["sepolia"].rpcUrl);

const contract = new ethers.Contract(RAFFLE_CONTRACT, RAFFLE_ABI, provider);
export async function getRaffleDetails(raffleId) {
  try {
    const details = await contract.getRaffleDetails(raffleId, {
      maxFeePerGas: ethers.utils.parseUnits("30", "gwei"),
      maxPriorityFeePerGas: ethers.utils.parseUnits("25", "gwei"),
      gasLimit: ethers.utils.hexlify(500000),
    });
    return details;
  } catch (error) {
    console.error(`Error fetching raffle details for ID ${raffleId}:`, error);
  }
}

export async function endRaffle(ctx, raffleId) {
  try {
    let wallet;
    if ((ctx.session.mmstate = "update_raffle")) {
      wallet = ctx.session.updateRaffleSelectedAddress;
    } else {
      const walletAddress = ctx.session.adminWalletAddress;
      const w = getWalletByAddress(ctx, walletAddress);
      const privateKey = decrypt(w.privateKey);
      wallet = new ethers.Wallet(privateKey, sepoliaProvider);
    }
    const contractWithSigner = new ethers.Contract(
      RAFFLE_CONTRACT,
      RAFFLE_ABI,
      wallet
    );
    if ((ctx.session.mmstate = "update_raffle")) {
      await ctx.reply("Open MetaMask to sign the transaction...");
    }
    await contractWithSigner.endRaffle(raffleId, {
      maxFeePerGas: ethers.utils.parseUnits("30", "gwei"),
      maxPriorityFeePerGas: ethers.utils.parseUnits("25", "gwei"),
      gasLimit: ethers.utils.hexlify(500000),
    });
    return 1;
  } catch (error) {
    console.error(`Error ending raffle:${error.message}`);
    return 0;
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
    let wallet;
    if ((ctx.session.mmstate = "update_raffle")) {
      wallet = ctx.session.updateRaffleSelectedAddress;
    } else {
      const walletAddress = ctx.session.adminWalletAddress;
      const w = getWalletByAddress(ctx, walletAddress);
      const privateKey = decrypt(w.privateKey);
      wallet = new ethers.Wallet(privateKey, sepoliaProvider);
    }
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
    if ((ctx.session.mmstate = "update_raffle")) {
      await ctx.reply("Open MetaMask to sign the transaction...");
    }
    const tx = await contractWithSigner.updateRaffle(
      raffleId,
      finalMaxTickets,
      finalEndTime,
      finalStartTime,
      finalMaxBuyPerWallet,
      finalTgOwner,
      finalTgOwnerPercent,
      {
        maxFeePerGas: ethers.utils.parseUnits("30", "gwei"),
        maxPriorityFeePerGas: ethers.utils.parseUnits("25", "gwei"),
        gasLimit: ethers.utils.hexlify(500000),
      }
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

contract.on("RaffleEnded", async (raffleId, winner, winnerShare) => {
  try {
    const raffle = await Raffle.findOne({
      raffleId: raffleId.toString(),
    });
    if (raffle) {
      raffle.isActive = false;
      await raffle.save();
      console.log(`Raffle ${raffleId} updated in the database.`);
    } else {
      console.log(`Raffle with ID ${raffleId} not found in the database.`);
    }
  } catch (error) {
    console.error("Error updating raffle:", error);
  }
});
contract.on(
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
    // if (admin.toLowerCase() === wallet.address.toLowerCase()) {
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
  // }
);
