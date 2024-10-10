import { Wallet, ethers, Contract } from "ethers";
import { CHAIN, RAFFLE_ABI, RAFFLE_CONTRACT } from "../config";
import { getWalletByAddress } from "./bot-utils";
import { decrypt } from "./encryption-utils";
import Raffle from "../models/raffle";
import { sendGroupMessage } from "./sendGroupMessage";
import { TotalRevenueDistributionModel } from "../models/total_revenue";
import { Markup } from "telegraf";
const provider = new ethers.providers.JsonRpcProvider(CHAIN["sepolia"].rpcUrl);

export const getWalletBalance = async (walletAddress) => {
  const balanceWei = await provider.getBalance(walletAddress);
  const balanceEth = ethers.utils.formatEther(balanceWei);
  return balanceEth;
};

const CHAIN_ID = "0x13882";

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

    // Notify the user that the process is starting
    await ctx.reply("Starting the process to end the raffle...");

    if (ctx.session.mmstate === "update_raffle") {
      if (
        ctx.session.updateRaffleSelectedAddress.provider.provider.chainId !==
        CHAIN_ID
      ) {
        return ctx.reply(
          "Invalid Network Selected!,\nChange Network and try again",
          Markup.inlineKeyboard([
            Markup.button.callback("Try Again", "metamask_add_raffle"),
          ])
        );
      }
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

    // Notify the user that gas estimation is in progress
    await ctx.reply("Estimating gas for ending the raffle...");

    const gasEstimate = await contractWithSigner.estimateGas.endRaffle(
      raffleId
    );

    if (ctx.session.mmstate !== "update_raffle") {
      const walletBalance = await getWalletBalance(wallet.address);
      const gasPrice = await wallet.provider.getGasPrice();
      const transactionCost = ethers.utils.formatEther(
        gasEstimate.mul(gasPrice)
      );

      // Notify the user if the balance is insufficient
      if (walletBalance < transactionCost) {
        return await ctx.reply("Not enough balance to sign the transaction.");
      }
    }

    if (ctx.session.mmstate === "update_raffle") {
      await ctx.reply("Please open MetaMask to sign the transaction...");
    } else {
      await ctx.reply("Signing the transaction to end the raffle...");
    }

    // Notify the user that the transaction is being sent
    await ctx.reply("Sending the transaction to the network...");

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

    // Wait for the transaction hash or timeout
    const transaction = await Promise.race([txPromise, timeoutPromise]);

    // Notify the user that the transaction has been sent, along with the transaction hash
    await ctx.reply(`Transaction sent: ${transaction.hash}`);
    await ctx.reply("Your transaction is being mined, please wait...");

    // Wait for the transaction to be mined
    const receipt = await transaction.wait();

    // Notify the user that the transaction has been successfully mined
    await ctx.reply(
      `Transaction mined successfully: ${receipt.transactionHash}`
    );

    return 1;
  } catch (error) {
    console.error(`Error ending raffle: ${error.message}`);
    await ctx.reply(`Error: ${error.message}`);
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
      if (
        ctx.session.updateRaffleSelectedAddress.provider.provider.chainId !==
        CHAIN_ID
      ) {
        return ctx.reply(
          "Invalid Network Selected!,\nChange Network and try again",
          Markup.inlineKeyboard([
            Markup.button.callback("Try Again", "metamask_add_raffle"),
          ])
        );
      }
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

// Listen for the RaffleEnded event and update both Raffle and TotalRevenueDistribution documents
contract.on(
  "RaffleEnded",
  async (
    raffleId,
    winner,
    winnerShare,
    serviceFee,
    referrer,
    referrerFee,
    tgOwner,
    tgOwnerShare
  ) => {
    console.log("Contract end raffle event called");

    try {
      const platformRevenue = parseFloat(ethers.utils.formatEther(serviceFee));
      const tgOwnerRevenue = parseFloat(ethers.utils.formatEther(tgOwnerShare));
      const referrerEarnings = parseFloat(
        ethers.utils.formatEther(referrerFee)
      );

      const revenueDistribution =
        await TotalRevenueDistributionModel.findOneAndUpdate(
          {},
          {
            $inc: {
              platformRevenue: platformRevenue,
              tgOwnerRevenue: tgOwnerRevenue,
              referrerEarnings: referrerEarnings,
            },
          },
          { new: true, upsert: true } // Create the document if it doesn't exist
        );
      const raffleDetails = await getRaffleDetails(raffleId);
      const rafflePool =
        ethers.utils.formatEther(raffleDetails.entryCost) *
        raffleDetails.ticketsSold;
      const raffle = await Raffle.findOne({
        raffleId: raffleId.toString(),
      });
      console.log("raffle on end raffle", raffle);

      if (raffle) {
        raffle.isActive = false;
        raffle.completedTime = Date.now();
        raffle.rafflePool = rafflePool;
        await raffle.save();

        console.log(
          `Raffle ${raffleId} updated in the database with completed time.`
        );

        const message = `
        Raffle Ended:
        - Raffle ID: ${raffleId}
        - Winner: ${winner}
        - Winner's Share: ${ethers.utils.formatEther(winnerShare)} ETH
        - Service Fee: ${ethers.utils.formatEther(serviceFee)} ETH
        - Referrer: ${referrer}
        - Referrer Fee: ${ethers.utils.formatEther(referrerFee)} ETH
        - TG Owner: ${tgOwner}
        - TG Owner Share: ${ethers.utils.formatEther(tgOwnerShare)} ETH
      `;
        sendGroupMessage(groupId, message);
      } else {
        console.log(`Raffle with ID ${raffleId} not found in the database.`);
      }
    } catch (error) {
      console.error(
        `Error updating revenue distribution or raffle: ${error.message}`
      );
    }
  }
);

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
        const message = `
Raffle Updated Successfully ✨
-----------------------------------------
Raffle ID            : ${raffleId}
Admin                : ${admin}
TG Owner             : ${tgOwner}
Raffle Start Time    : ${raffleStartTime}
Raffle End Time      : ${raffleEndTime}
Max Tickets          : ${maxTickets}
TG Owner Percentage  : ${(tgOwnerPercentage / 100).toFixed(2)}% 
Max Buy Per Wallet   : ${maxBuyPerWallet}
-----------------------------------------
`;
        sendGroupMessage(groupId, message);
      } else {
        console.error("Failed to update raffle in the database");
      }
    } catch (error) {
      console.error("Error updating raffle in the database:", error);
    }
  }
  // }
);

contract.on("MaxTicketsSold", async (raffleId, numberOfTickets) => {
  try {
    const raffle = await Raffle.findOne({ raffleId });
    console.log(raffle);
    if (raffle) {
      const userId = raffle.userId;
      const message = `Max Tickets(${numberOfTickets}) sold out for raffle id ${raffleId}, Please end it now`;
      sendGroupMessage(userId, message);
    } else {
      console.log(`Raffle with ID ${raffleId} not found in the database.`);
    }
  } catch (error) {
    console.error(
      `Error updating revenue distribution or raffle: ${error.message}`
    );
  }
});
