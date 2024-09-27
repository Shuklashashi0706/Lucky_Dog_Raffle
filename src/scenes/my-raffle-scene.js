const { Scenes, Markup } = require("telegraf");
const { BaseScene } = Scenes;
import Raffle from "../models/raffle";
export const myRaffle = new BaseScene("myRaffle");
import { CHAIN, RAFFLE_ABI, RAFFLE_CONTRACT } from "../config";
const { ethers } = require("ethers");

let previousMessages = []; // Array to keep track of message IDs

// Function to delete previous messages
const deletePreviousMessages = async (ctx) => {
  try {
    for (const messageId of previousMessages) {
      await ctx.telegram.deleteMessage(ctx.chat.id, messageId).catch(() => {});
    }
    previousMessages = []; // Clear the array after deleting messages
  } catch (error) {
    console.error("Error deleting previous messages:", error);
  }
};

// Function to show details of a specific raffle using emojis
const showRaffleDetails = async (ctx, raffleId) => {
  try {
    // Delete previous messages
    await deletePreviousMessages(ctx);
    await ctx.reply("Fetching raffle details....");
    // Fetch the raffle details based on raffleId from MongoDB
    const raffle = await Raffle.findOne({ raffleId: raffleId });
    if (!raffle) {
      const response = await ctx.reply("Raffle not found in database.");
      previousMessages.push(response.message_id); // Store new message ID
      return;
    }

    // Connect to the blockchain and fetch raffle details from the contract
    const provider = new ethers.providers.JsonRpcProvider(
      CHAIN["sepolia"].rpcUrl
    );
    const contract = new ethers.Contract(RAFFLE_CONTRACT, RAFFLE_ABI, provider);
    const raffleDetails = await contract.getRaffleDetails(raffle.raffleId);

    // Extract and format raffle details
    const formattedDetails = {
      admin: raffleDetails[0],
      tgOwner: raffleDetails[1],
      winner:
        raffleDetails[2] === "0x0000000000000000000000000000000000000000"
          ? "No winner yet"
          : raffleDetails[2],
      entryCost: ethers.utils.formatEther(raffleDetails[3]), // Convert from wei to ETH
      raffleStartTime: new Date(
        raffleDetails[4].toNumber() * 1000
      ).toUTCString(), // Convert Unix timestamp to UTC string
      raffleEndTime:
        raffleDetails[5].toNumber() === 0
          ? "Not set"
          : new Date(raffleDetails[5].toNumber() * 1000).toUTCString(),
      maxTickets: raffleDetails[6].toNumber(),
      isActive: raffleDetails[7],
      tgOwnerPercentage: raffleDetails[8].toNumber(),
      maxBuyPerWallet: raffleDetails[9].toNumber(),
      referrer:
        raffleDetails[10] === "0x0000000000000000000000000000000000000000"
          ? "No referrer"
          : raffleDetails[10],
      ticketsSold: raffleDetails[11].toNumber(),
    };

    // Construct the message with formatted details
    const message = `
🎟️ *Raffle Title:* ${raffle.raffleTitle}
👥 *Group ID:* ${raffle.groupId}
💰 *Entry Cost:* ${formattedDetails.entryCost} ETH
⏰ *Start Time:* ${formattedDetails.raffleStartTime}
⌛ *End Time:* ${formattedDetails.raffleEndTime}
🎟️ *Tickets Sold:* ${formattedDetails.ticketsSold}
🔢 *Max Tickets:* ${formattedDetails.maxTickets}
🏷️ *Max Tickets Per Wallet:* ${formattedDetails.maxBuyPerWallet}
🧑‍💼 *Owner:* ${formattedDetails.tgOwner}
🎯 *Winner:* ${formattedDetails.winner}
🔄 *Is Active:* ${formattedDetails.isActive ? "Yes" : "No"}
🔗 *Referrer:* ${formattedDetails.referrer}
`;

    // Send the formatted message to the user
    const response = await ctx.replyWithMarkdown(message);
    previousMessages.push(response.message_id); // Store new message ID
  } catch (error) {
    console.error("Error showing raffle details:", error);
    const response = await ctx.reply(
      "Sorry, an error occurred while showing raffle details."
    );
    previousMessages.push(response.message_id); // Store new message ID
  }
};

// Function to handle active raffles
const showActiveRaffles = async (ctx) => {
  try {
    // Delete previous messages
    await deletePreviousMessages(ctx);

    const userId = ctx.from.id.toString();

    const activeRaffles = await Raffle.aggregate([
      {
        $match: {
          userId: userId,
          isActive: true,
        },
      },
      {
        $project: {
          _id: 0,
          raffleId: 1,
          raffleTitle: 1,
          groupId: 1,
        },
      },
    ]);

    if (activeRaffles.length > 0) {
      // Create a list of buttons with each raffle
      const buttons = activeRaffles.map((raffle) => [
        Markup.button.callback(
          `🎟️ ${raffle.raffleTitle} (Group: ${raffle.groupId})`,
          `raffle_${raffle.raffleId}`
        ),
      ]);

      const response = await ctx.reply(
        "Your Active Raffles:",
        Markup.inlineKeyboard(buttons)
      );
      previousMessages.push(response.message_id); // Store new message ID
    } else {
      const response = await ctx.reply("You have no active raffles.");
      previousMessages.push(response.message_id); // Store new message ID
    }
  } catch (error) {
    console.error("Error fetching active raffles:", error);
    const response = await ctx.reply(
      "Sorry, an error occurred while fetching active raffles."
    );
    previousMessages.push(response.message_id); // Store new message ID
  }
};

// Function to handle completed raffles
const showCompletedRaffles = async (ctx) => {
  try {
    // Delete previous messages
    await deletePreviousMessages(ctx);

    const userId = ctx.from.id.toString();
    const currentTime = Math.floor(Date.now() / 1000); // Current time in seconds

    // MongoDB aggregation to fetch completed raffles for the user
    const completedRaffles = await Raffle.aggregate([
      {
        $match: {
          userId: userId, // Match userId from context
          isActive: false, // Only inactive raffles
        },
      },
      {
        $addFields: {
          isCompleted: {
            $or: [
              { $gt: [currentTime, "$raffleEndTime"] }, // Current time > raffleEndTime
              { $gte: ["$ticketsSold", "$maxTickets"] }, // Tickets sold >= maxTickets
            ],
          },
        },
      },
      {
        $match: {
          isCompleted: true, // Filter for completed raffles
        },
      },
      {
        $project: {
          _id: 0, // Exclude _id field
          raffleId: 1, // Include raffleId
          raffleTitle: 1, // Include raffle title
          groupId: 1, // Include group id
        },
      },
    ]);

    // Check if there are any completed raffles
    if (completedRaffles.length > 0) {
      // Create a list of buttons with each raffle
      const buttons = completedRaffles.map((raffle) => [
        Markup.button.callback(
          `🎟️ ${raffle.raffleTitle} (Group: ${raffle.groupId})`,
          `raffle_${raffle.raffleId}`
        ),
      ]);

      const response = await ctx.reply(
        "Your Completed Raffles:",
        Markup.inlineKeyboard(buttons)
      );
      previousMessages.push(response.message_id); // Store new message ID
    } else {
      const response = await ctx.reply("You have no completed raffles.");
      previousMessages.push(response.message_id); // Store new message ID
    }
  } catch (error) {
    console.error("Error fetching completed raffles:", error);
    const response = await ctx.reply(
      "Sorry, an error occurred while fetching completed raffles."
    );
    previousMessages.push(response.message_id); // Store new message ID
  }
};

// Handle button actions for raffle details
myRaffle.action(/raffle_\d+/, async (ctx) => {
  const raffleId = ctx.match[0].split("_")[1]; // Extract the raffleId from the button callback
  await showRaffleDetails(ctx, raffleId);
});

// Scene entry point
myRaffle.enter(async (ctx) => {
  await deletePreviousMessages(ctx); // Delete previous messages on entering the scene
  const response = await ctx.reply(
    "Select an option:",
    Markup.inlineKeyboard([
      [Markup.button.callback("Active Raffles", "show_active_raffles")],
      [Markup.button.callback("Completed Raffles", "completed")],
    ])
  );
  previousMessages.push(response.message_id); // Store new message ID
});

// Handle button action to show active raffles
myRaffle.action("show_active_raffles", async (ctx) => {
  await showActiveRaffles(ctx);
});

// Handle button actions for completed raffles
myRaffle.action("completed", async (ctx) => {
  await showCompletedRaffles(ctx);
  await ctx.scene.leave();
});
