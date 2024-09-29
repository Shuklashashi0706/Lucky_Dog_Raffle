import { Wallet, ethers, Contract } from "ethers";
import { CHAIN, RAFFLE_ABI, RAFFLE_CONTRACT } from "../config";
import { getWalletByAddress } from "./bot-utils";
import { decrypt } from "./encryption-utils";
import Raffle from "../models/raffle";
import { sendGroupMessage } from "./sendGroupMessage";

const provider = new ethers.providers.JsonRpcProvider(CHAIN["sepolia"].rpcUrl);

export const getWalletBalance = async (walletAddress) => {
  const balanceWei = await provider.getBalance(walletAddress);
  const balanceEth = ethers.utils.formatEther(balanceWei);
  return balanceEth;
};

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

let groupId;

export async function endRaffle(ctx, raffleId) {
  try {
    groupId = ctx.session.createdGroup;
    let wallet;
    if (ctx.session.mmstate === "update_raffle") {
      wallet = ctx.session.updateRaffleSelectedAddress;
    } else {
      const walletAddress = ctx.session.adminWalletAddress;
      const w = getWalletByAddress(ctx, walletAddress);
      const privateKey = decrypt(w.privateKey);
      wallet = new ethers.Wallet(privateKey, provider);
    }
    const contractWithSigner = new ethers.Contract(
      RAFFLE_CONTRACT,
      RAFFLE_ABI,
      wallet
    );
    let walletBalance;
    const gasEstimate = await contractWithSigner.estimateGas.endRaffle(
      raffleId
    );
    if (ctx.session.mmstate !== "update_raffle") {
      walletBalance = await getWalletBalance(wallet.address);
      const gasPrice = await wallet.provider.getGasPrice();
      const transactionCost = ethers.utils.formatEther(
        gasEstimate.mul(gasPrice)
      );
      if (walletBalance < transactionCost) {
        return await ctx.reply("Not enough balance to sign the transaction");
      }
    }
    if (ctx.session.mmstate === "update_raffle") {
      await ctx.reply("Open MetaMask to sign the transaction...");
    }
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error("Transaction request timed out")),
        60000
      )
    );

    const txPromise = contractWithSigner.endRaffle(raffleId, {
      maxFeePerGas: ethers.utils.parseUnits("30", "gwei"),
      maxPriorityFeePerGas: ethers.utils.parseUnits("25", "gwei"),
      gasLimit: ethers.utils.hexlify(500000),
    });
    const transaction = await Promise.race([txPromise, timeoutPromise]);

    await ctx.reply(`Transaction sent: ${transaction.hash}`);
    await ctx.reply(`Your transaction is getting mined, please wait...`);

    const receipt = await transaction.wait();
    await ctx.reply(`Transaction mined: ${receipt.transactionHash}`);
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
    if (ctx.session.mmstate === "update_raffle") {
      wallet = ctx.session.updateRaffleSelectedAddress;
    } else {
      const walletAddress = ctx.session.adminWalletAddress;
      const w = getWalletByAddress(ctx, walletAddress);
      const privateKey = decrypt(w.privateKey);
      wallet = new ethers.Wallet(privateKey, provider);
    }
    const contractWithSigner = new ethers.Contract(
      RAFFLE_CONTRACT,
      RAFFLE_ABI,
      wallet
    );

    let walletBalance;
    const gasEstimate = await contractWithSigner.estimateGas.endRaffle(
      raffleId
    );
    if (ctx.session.mmstate !== "update_raffle") {
      walletBalance = await getWalletBalance(wallet.address);
      const gasPrice = await wallet.provider.getGasPrice();
      const transactionCost = ethers.utils.formatEther(
        gasEstimate.mul(gasPrice)
      );
      if (walletBalance < transactionCost) {
        return await ctx.reply("Not enough balance to sign the transaction");
      }
    }
    if (ctx.session.mmstate === "update_raffle") {
      await ctx.reply("Open MetaMask to sign the transaction...");
    }
    const tx = await contractWithSigner.updateRaffle(
      raffleId,
      newMaxTickets,
      newEndTime,
      newStartTime,
      newMaxBuyPerWallet,
      newTgOwner,
      newTgOwnerPercent,
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
    ctx.scene.leave();
  } catch (error) {
    console.error(error);
    ctx.reply("Failed to update the raffle try again");
    ctx.scene.leave();
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
      const message = `Raffle ${raffleId} has ended\nWinner: ${winner}\nWinner share: ${winnerShare}`;
      sendGroupMessage(groupId, message);
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
