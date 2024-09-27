const { Scenes, Markup } = require("telegraf");
const { BaseScene } = Scenes;
import Raffle from "../models/raffle";
export const myRaffle = new BaseScene("myRaffle");

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

    // Fetch the raffle details based on raffleId
    const raffle = await Raffle.findOne({ raffleId: raffleId });

    if (raffle) {
      const message = `
🎟️ *Raffle Title:* ${raffle.raffleTitle}
👥 *Group ID:* ${raffle.groupId}
💰 *Entry Cost:* ${raffle.entryCost} ETH
⏰ *Start Time:* ${new Date(raffle.raffleStartTime * 1000).toUTCString()}
⌛ *End Time:* ${new Date(raffle.raffleEndTime * 1000).toUTCString()}
🎟️ *Tickets Sold:* ${raffle.ticketsSold}
🧑‍💼 *Owner:* ${raffle.tgOwner}
🏷️ *Max Tickets Per Wallet:* ${raffle.maxBuyPerWallet}
`;

      const response = await ctx.replyWithMarkdown(message);
      previousMessages.push(response.message_id); // Store new message ID
    } else {
      const response = await ctx.reply("Raffle not found.");
      previousMessages.push(response.message_id); // Store new message ID
    }
  } catch (error) {
    console.error("Error showing raffle details:", error);
    const response = await ctx.reply("Sorry, an error occurred while showing raffle details.");
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

      const response = await ctx.reply("Your Active Raffles:", Markup.inlineKeyboard(buttons));
      previousMessages.push(response.message_id); // Store new message ID
    } else {
      const response = await ctx.reply("You have no active raffles.");
      previousMessages.push(response.message_id); // Store new message ID
    }
  } catch (error) {
    console.error("Error fetching active raffles:", error);
    const response = await ctx.reply("Sorry, an error occurred while fetching active raffles.");
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
