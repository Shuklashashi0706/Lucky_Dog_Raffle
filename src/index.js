import dotenv from "dotenv";
import cors from "cors";
import express from "express";
import { Telegraf, session, Scenes, Markup } from "telegraf";
import { menuCommand, walletsCommand } from "./utils/bot-utils";
import connectDB from "./utils/connect-db";
import Group from "./models/group";
import Raffle from "./models/raffle";
import { ethers } from "ethers";
import {
  raffleScene,
  handleGroupSelection,
  addRaffleScenes,
  handleAddRaffle,
  handleCreateRaffleWithoutReferral,
  handleCreateRaffleWithReferral,
} from "./scenes/add-raffle-actions";
import { buyRaffleScenes, escapeMarkdown } from "./scenes/buy-raffle-scene";
import { buyRafflePaymentScenes } from "./utils/buyRaffle";
import { botEventEmitter } from "./scenes/buy-raffle-scene";
import { getRaffleDetails } from "./utils/contract-functions";
import {
  handleReferralCode,
  handleCreateNewReferal,
  handleInputWalletPrompt,
  handleSelectWallet,
  handleWalletSelection,
} from "./scenes/referal-code";
import { walletReferralScene } from "./scenes/referal-code";
import { importWalletScene } from "./scenes/importWalletScene";
import { generateWalletSeedScene } from "./scenes/generateWalletSeedScene";
import { importWalletStep } from "./scenes/importWalletScene";
import { chooseWalletNameStep } from "./scenes/chooseWalletNameScene";
import { generateWalletSeedStep } from "./scenes/generateWalletSeedScene";
import { btnDeleteWalletAction } from "./utils/bot-utils";
import { getWalletByName, dynamicDeleteWalletAction } from "./utils/bot-utils";
import { prevMessageState } from "./utils/state";
import { updateRaffleScenes } from "./scenes/update-raffle";
import {
  handleBuyRaffle,
  handleBuyRaffleWithoutWallet,
} from "./utils/buyRaffle";
import { myRaffle } from "./scenes/my-raffle-scene";
import { handleMMTransactions } from "./utils/mm-sdk";
import { handleGlobalMetrics } from "./controllers/global-metrics";
import { handleActiveRaffles } from "./controllers/active-raffles";
import { handleCompletedRaffles } from "./controllers/completed_raffles";
import { handleRevenueDistribution } from "./controllers/revenuedistribution";
import { handleRafflePool } from "./controllers/raffle-pool";
dotenv.config();

if (!process.env.TELEGRAM_BOT_TOKEN) {
  console.error("Setup your token");
  process.exit(1);
}
let bot;
if (process.env.NODE_ENV === "development") {
  bot = new Telegraf(process.env.LOCAL_TELEGRAM_BOT_TOKEN);
} else {
  bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
}

const stage = new Scenes.Stage([
  importWalletStep,
  chooseWalletNameStep,
  generateWalletSeedStep,
  ...addRaffleScenes,
  ...updateRaffleScenes,
  ...buyRaffleScenes,
  ...buyRafflePaymentScenes,
  myRaffle,
  walletReferralScene,
]);

bot.use(session());

bot.use(stage.middleware());

// Function to check if a user has blocked the bot
async function checkBlockedUser(ctx, userId) {
  try {
    await ctx.telegram.sendChatAction(userId, "typing");
    return false; // User has not blocked the bot
  } catch (error) {
    if (error.response && error.response.error_code === 403) {
      console.log(`User ${userId} has blocked the bot.`);
      return true; // User has blocked the bot
    } else {
      console.error("An unexpected error occurred:", error);
      return true; // Treat other errors conservatively
    }
  }
}

// Handle the start command
bot.start(async (ctx) => {
  if (ctx.chat?.type.includes("group")) {
    return;
  }
  // Check if the user has blocked the bot
  const isBlocked = await checkBlockedUser(ctx, ctx.from.id);
  if (isBlocked) {
    return;
  }

  try {
    // Create inline keyboard buttons
    const keyboard = Markup.inlineKeyboard([
      [
        Markup.button.url(
          "Add bot to group",
          `https://t.me/${ctx.botInfo.username}?startgroup=true&admin=change_info+delete_messages+restrict_members+invite_users+pin_messages+manage_topics+manage_video_chats+promote_members`
        ),
      ],
      [
        Markup.button.callback(
          "Create/Update a raffle",
          "CREATE_UPDATE_RAFFLE"
        ),
      ],
    ]);

    await ctx.reply(
      "Welcome to Lucky Dog Raffle Bot! Telegram's Original Buy Bot! What would you like to do today?",
      keyboard
    );
  } catch (error) {
    console.error("Error while sending message:", error);
  }
});

// Handle the "Create/Update a raffle" button action
bot.action("CREATE_UPDATE_RAFFLE", async (ctx) => {
  await ctx.deleteMessage();
  await ctx.reply("Create Raffle option selected");
  await handleAddRaffle(ctx);
});

// General middleware to handle all types of actions
bot.use(async (ctx, next) => {
  const isBlocked = await checkBlockedUser(ctx, ctx.from.id);
  if (isBlocked) {
    return;
  }
  await next();
});

// -----------------------  wallet setup start -----------------------------

// back buttons

bot.action("back-to-main-menu", async (ctx) => {
  if (prevMessageState.prevMessage) {
    await ctx.deleteMessage(prevMessageState.prevMessage.message_id);
  }
  delete ctx.session.selectedDeleteWalletName;
  delete ctx.session.selectedPlayWalletName;
  delete ctx.session.selectedRefundWalletName;
  await walletsCommand(ctx, ctx.session.wallets);
});

bot.command("wallets", async (ctx) => {
  if (ctx.chat?.type.includes("group")) {
    return;
  }
  await walletsCommand(ctx, ctx.session.wallets);
});

bot.action("wallets", async (ctx) => {
  if (prevMessageState.prevMessage) {
    await ctx.deleteMessage(prevMessageState.prevMessage.message_id);
  }

  await walletsCommand(ctx, ctx.session.wallets);
});

bot.action(/^metamask_(.*)/, async (ctx) => {
  await ctx.deleteMessage();
  ctx.session.mmstate = ctx.match[1];
  await handleMMTransactions(ctx);
});

// create wallet buttons
bot.action("import-existing-wallet", async (ctx) => {
  await ctx.deleteMessage();
  ctx.scene.enter(importWalletScene);
});

bot.action("generate-wallet-seed", async (ctx) => {
  await ctx.deleteMessage();
  ctx.scene.enter(generateWalletSeedScene);
});

bot.action("btn-delete-wallet", async (ctx) => {
  if (prevMessageState.prevMessage) {
    await ctx.deleteMessage(prevMessageState.prevMessage.message_id);
  }
  await btnDeleteWalletAction(ctx, ctx.session.wallets);
});

bot.action(/^delete-wallet-/, async (ctx) => {
  if (prevMessageState.prevMessage) {
    await ctx.deleteMessage(prevMessageState.prevMessage.message_id);
  }
  const walletName = ctx.update.callback_query.data.split("-")[2];
  ctx.session.selectedDeleteWalletName = walletName;
  const wallet = getWalletByName(ctx, walletName);
  await dynamicDeleteWalletAction(ctx, wallet);
});

bot.action("confirm-delete-wallet", async (ctx) => {
  if (prevMessageState.prevMessage) {
    await ctx.deleteMessage(prevMessageState.prevMessage.message_id);
  }
  ctx.session.wallets = ctx.session.wallets.filter(
    (_wallet) => _wallet.name !== ctx.session.selectedDeleteWalletName
  );

  delete ctx.session.selectedDeleteWalletName;

  if (ctx.session.wallets.length) {
    await btnDeleteWalletAction(ctx, ctx.session.wallets);
  } else {
    await walletsCommand(ctx, ctx.session.wallets);
  }
});
// -----------------------  wallet setup end -----------------------------

// ----------------- referal code start -----------
bot.command("referral_code", async (ctx) => {
  if (ctx.chat?.type.includes("group")) {
    return;
  }
  await handleReferralCode(ctx);
});

bot.action("create_new_referral", async (ctx) => {
  if (prevMessageState.prevMessage) {
    await ctx.deleteMessage(prevMessageState.prevMessage.message_id);
  }
  await handleCreateNewReferal(ctx);
});

bot.action("input_wallet_address", async (ctx) => {
  if (prevMessageState.prevMessage) {
    await ctx.deleteMessage(prevMessageState.prevMessage.message_id);
  }
  // await handleInputWalletPrompt(ctx);
  await ctx.scene.enter("walletReferralScene");
});

bot.action("select_wallet_address", async (ctx) => {
  if (prevMessageState.prevMessage) {
    await ctx.deleteMessage(prevMessageState.prevMessage.message_id);
  }
  await handleSelectWallet(ctx);
});

bot.action(/^select_wallet_/, async (ctx) => {
  const walletAddress = ctx.match.input.split("select_wallet_")[1]; // Extract wallet address from callback data

  if (!walletAddress) {
    ctx.reply("Failed to identify the selected wallet. Please try again.");
    return;
  }

  await handleWalletSelection(ctx, walletAddress);
});

bot.action("enter_referral_again", async (ctx) => {
  await handleCreateRaffleWithReferral(ctx);
});

bot.action("proceed_without_referral", async (ctx) => {
  const walletAddress = ctx.session.walletAddress;
  await handleCreateRaffleWithoutReferral(ctx, walletAddress);
});

bot.action(/^wallet_(.*)/, async (ctx) => {
  await ctx.deleteMessage();
  const walletAddress = ctx.match[1];
  prevMessageState.prevMessage = await ctx.reply(
    `Do you have any referral code?\nCreate with referral code, 2% service fee for bot and 0.5% referral fee for referrer.\nCreate without referral code, 3% service fee for bot.`,
    {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "Yes, I have a referral code",
              callback_data: `has_referral_${walletAddress}`,
            },
          ],
          [
            {
              text: "No, continue without referral",
              callback_data: `no_referral_${walletAddress}`,
            },
          ],
        ],
      },
    }
  );
});

bot.action(/^has_referral_(.*)/, async (ctx) => {
  if (prevMessageState.prevMessage) {
    await ctx.deleteMessage(prevMessageState.prevMessage.message_id);
  }
  const walletAddress = ctx.match[1];
  ctx.session.referralSelectedWalletAddress = walletAddress;
  await ctx.scene.enter("handleCreateRaffleWithReferral");
});

bot.action(/^no_referral_(.*)/, async (ctx) => {
  if (prevMessageState.prevMessage) {
    await ctx.deleteMessage(prevMessageState.prevMessage.message_id);
  }
  const walletAddress = ctx.match[1]; // Extract wallet address from callback data
  await handleCreateRaffleWithoutReferral(ctx, walletAddress);
});
// -------------- create raffle end ------------

// -----------------------adding bot to group start-------------------
bot.on("new_chat_members", async (ctx) => {
  if (
    ctx.message.new_chat_members.some((member) => member.id === ctx.botInfo.id)
  ) {
    // Extracting group and bot details from the context
    const groupId = ctx.chat.id.toString();
    const groupUsername = ctx.chat.title;
    const botId = ctx.botInfo.id.toString();
    const botUsername = ctx.botInfo.username;
    const username = ctx.message.from.username || "Unknown"; // Fallback if username is not available
    const userId = ctx.message.from.id;

    try {
      // Check if the group already exists
      const existingGroup = await Group.findOne({ groupId, botId });
      if (existingGroup) {
        ctx.reply(
          `Lucky Dog Raffle Bot is already present in this group! Please click [here](https://t.me/${ctx.botInfo.username}) to continue the setup in the private chat.`,
          { parse_mode: "Markdown" }
        );
        return;
      }

      // Create a new Group document
      const newGroup = new Group({
        groupId,
        groupUsername,
        botId,
        botUsername,
        username,
        userId,
        raffleId: null, // Set to null initially or link to an existing raffle if available
      });

      // Save the new group details to the database
      await newGroup.save();
      console.log(
        `Bot added group: ${groupId}. Group document added successfully`
      );
      ctx.reply(
        `Lucky Dog Raffle Bot has been added to the group! Please click [here](https://t.me/${ctx.botInfo.username}) to continue the setup in the private chat.`,
        { parse_mode: "Markdown" }
      );
    } catch (error) {
      console.error("Error saving group details:", error);

      // Handle different types of errors
      if (error instanceof mongoose.Error.ValidationError) {
        ctx.reply(
          "Validation error occurred. Please ensure all required information is correct."
        );
      } else if (error.code === 11000) {
        // Duplicate key error
        ctx.reply("It seems the bot is already added to this group.");
      } else {
        ctx.reply(
          "An unexpected error occurred while saving the group details. Please try again or contact support."
        );
      }
    }
  }
});

bot.on("left_chat_member", async (ctx) => {
  // Check if the member who left is the bot itself
  if (ctx.message?.left_chat_member?.id === ctx.botInfo.id) {
    // Extract group and bot details from the context
    const groupId = ctx.chat.id.toString();
    const botId = ctx.botInfo.id.toString();
    const botUsername = ctx.botInfo.username;

    try {
      // Attempt to find and delete the corresponding group document
      const groupResult = await Group.findOneAndDelete({
        groupId,
        botId,
        botUsername,
      });

      if (groupResult) {
        console.log(
          `Bot removed from group: ${groupId}. Group document deleted successfully.`
        );

        // Attempt to delete all raffles associated with the group ID
        const raffleResult = await Raffle.deleteMany({ createdGroup: groupId });

        if (raffleResult.deletedCount > 0) {
          console.log(
            `Deleted ${raffleResult.deletedCount} raffle(s) associated with group: ${groupId}.`
          );
        } else {
          console.log(
            `No raffles found associated with group: ${groupId}. No raffles were deleted.`
          );
        }
      } else {
        console.log(`No matching group document found for group: ${groupId}.`);
      }
    } catch (error) {
      console.error(
        "Error removing group document or associated raffles:",
        error
      );
    }
  }
});

bot.action(/^SELECT_GROUP_/, handleGroupSelection);

bot.action(/^ADD_RAFFLE_(.*)/, async (ctx) => {
  await ctx.deleteMessage();

  const groupId = ctx.match[1];

  const existingRaffle = await Raffle.findOne({
    groupId: groupId,
    isActive: true,
  });

  if (existingRaffle) {
    await ctx.reply("Raffle already exists and running in selected group.");
  } else {
    await ctx.reply("Add Raffle option selected");
    ctx.session.groupId = groupId;
    ctx.scene.enter("raffleScene");
  }
});

bot.action(/^UPDATE_RAFFLE_(.*)/, async (ctx) => {
  await ctx.deleteMessage();
  const groupId = ctx.match[1];
  ctx.scene.enter("updateRaffleScene");
});

bot.action(/^VIEW_RAFFLE_(.*)/, async (ctx) => {
  // Delete the previous message if it exists
  if (prevMessageState.prevMessage) {
    await ctx.deleteMessage(prevMessageState.prevMessage.message_id);
  }

  const groupId = ctx.match[1]; // Get groupId from the regex match

  try {
    // Find the active raffle for the group
    const raffle = await Raffle.findOne({
      groupId: groupId,
      isActive: true,
    }).select("raffleId");

    // If no active raffle exists, prompt to add a new one
    if (!raffle) {
      await ctx.reply(
        "No raffle running in this group, start by creating one.",
        Markup.inlineKeyboard([
          Markup.button.callback("Add a new Raffle", `ADD_RAFFLE_${groupId}`),
        ])
      );
      return ctx.scene.leave();
    }

    // Get raffle details using raffleId
    const raffleDetails = await getRaffleDetails(raffle.raffleId);

    // If raffle is not active, show a message to add a new raffle
    if (!raffleDetails.isActive) {
      await ctx.reply(
        "No raffle running in this group, start by creating one.",
        Markup.inlineKeyboard([
          Markup.button.callback("Add a new Raffle", `ADD_RAFFLE_${groupId}`),
        ])
      );
    } else {
      // Save raffleId and details in the session
      ctx.session.raffleId = raffle.raffleId;
      ctx.session.raffleDetails = raffleDetails;

      // Prepare the raffle details message
      const winner =
        raffleDetails.winner === "0x0000000000000000000000000000000000000000"
          ? "No Winner Yet"
          : raffleDetails.winner;

      const message = `
Raffle Details ✨
-----------------------------------------
Raffle ID            : ${raffle.raffleId}
Admin                : ${raffleDetails.admin}
TG Owner             : ${raffleDetails.tgOwner}
Winner               : ${winner}
Entry Cost           : ${ethers.utils.formatEther(
        raffleDetails.entryCost
      )} Ether
Raffle Start Time    : ${new Date(
        raffleDetails.raffleStartTime * 1000
      ).toUTCString()}
${
  raffleDetails.raffleEndTime.toNumber() !== 0
    ? `Raffle End Time      : ${new Date(
        raffleDetails.raffleEndTime * 1000
      ).toUTCString()}`
    : `Max Tickets          : ${raffleDetails.maxTickets}`
}
Is Active            : ${raffleDetails.isActive ? "Yes" : "No"}
TG Owner Percentage  : ${(raffleDetails.tgOwnerPercentage / 100).toFixed(2)}% 
Max Buy Per Wallet   : ${raffleDetails.maxBuyPerWallet}
Referrer             : ${raffleDetails.referrer}
Tickets Sold         : ${raffleDetails.ticketsSold}
-----------------------------------------
`;

      // Send the raffle details message
      await ctx.reply(message);
    }
  } catch (error) {
    console.error("Error viewing raffle details:", error);
    await ctx.reply(
      "There was an error retrieving the raffle details. Please try again."
    );
  }
});

// -----------------------adding bot to group end-------------------

// ---------------------------- buy raffle start------------------------------
bot.command("lucky", async (ctx) => {
  ctx.scene.enter("buyRaffleScene");
});
// Event listener for 'dmSent' to trigger action
botEventEmitter.on("dmSent", async ({ userId, ctx, raffleDetails }) => {
  ctx.session.raffleDetails = raffleDetails;
  await bot.handleUpdate({
    ...ctx.update,
    message: {
      text: "sendmessageinprivatedm",
      chat: { id: userId },
      from: { id: userId },
    },
  });
});

// Action handler for 'sendmessageinprivatedm'
bot.action("sendmessageinprivatedm", async (ctx) => {
  await ctx.scene.enter("buyRafflePaymentScene");
});

// Action handler for wallet selection
bot.action(/buy_raffle_wallet_(.+)/, async (ctx) => {
  const selectedWallet = ctx.match[1];
  if (selectedWallet === "metamask") {
    await ctx.reply(
      "You selected Metamask application. Please proceed with the Metamask payment."
    );
    // Add your Metamask payment handling logic here
  } else {
    ctx.session.buyRaffleSelectedWalletAddress = selectedWallet;
    await ctx.scene.enter("buyRaffleContractCallScene");
  }
});

// ---------------------------- buy raffle end------------------------------

//--------------------my raffle start -------------------------
bot.command("my_raffles", async (ctx) => {
  await ctx.scene.enter("myRaffle");
});
//--------------------my raffle end -------------------------

//--------------history start----------------------------
bot.command("history", async (ctx) => {
  try {
    const userId = ctx.message.from.id;
    const lastFiveCompletedRaffles = await Raffle.find({
      userId: userId,
      isActive: false,
    })
      .sort({ raffleId: -1 }) // Sort by raffleId in descending order
      .limit(5); // Limit to 5 raffles

    // Check if any completed raffles were found
    if (lastFiveCompletedRaffles.length === 0) {
      await ctx.reply("❌ No completed raffles found.");
      return;
    }

    // Prepare a text to display the last 5 completed raffles
    let message = "🎉 *Last 5 Completed Raffles* 🎉\n\n";
    lastFiveCompletedRaffles.forEach((raffle, index) => {
      message += `*${index + 1}.*`;
      message += `🏆 *Raffle ID*: \`${raffle.raffleId}\`\n`;
      message += `👤 *Winner*: ${raffle.winner || "Unknown"}\n`;
      message += `🎟️ *Raffle Title*: _${escapeMarkdown(raffle.raffleTitle)}_\n`;
      message += `\n-------------------\n\n`;
    });

    // Send the message to the user
    await ctx.replyWithMarkdown(message); // Using Markdown formatting
  } catch (error) {
    console.error("Error fetching completed raffles:", error);
    await ctx.reply(
      "⚠️ An error occurred while fetching the raffle history. Please try again later."
    );
  }
});

bot.command("cancel", (ctx) => {
  ctx.reply("Cancelling the current operation...");
  ctx.scene.leave();
});

bot.hears(["start", "/cancel", "/wallets"], () => {
  console.log("hears");
});

connectDB();

if (process.env.NODE_ENV === "development") {
  bot.launch(() => {
    console.log("Bot is running in dev mode");
  });
} else if (process.env.NODE_ENV === "production") {
  const app = express();
  app.use(express.json());
  app.use(cors());
  app.use(bot.webhookCallback("/secret-path"));
  bot.telegram.setWebhook(`${process.env.SERVER_URL}/secret-path`);
  app.get("/api/v1/global-metrics", handleGlobalMetrics);
  app.get("/api/v1/active-raffles", handleActiveRaffles);
  app.get("/api/v1/completed-raffles", handleCompletedRaffles);
  app.get("/api/v1/revenue-distribution", handleRevenueDistribution);
  app.get("/api/v1/raffle-pool", handleRafflePool);
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

// Enable graceful stop
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
