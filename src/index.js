import dotenv from "dotenv";
import express from "express";
import { Telegraf, session, Scenes, Markup } from "telegraf";
import { menuCommand, walletsCommand } from "./utils/bot-utils";
import connectDB from "./utils/connect-db";
import Group from "./models/group";
import Raffle from "./models/raffle";
import {
  handleAddRaffle,
  handleCancel,
  handleConfirmDetails,
  handleNoSplitPool,
  handleSelectTime,
  handleSplitPool,
  handleStartRaffleNow,
  handleTextInputs,
  handleTimeBasedLimit,
  handleValueBasedLimit,
  handleGroupSelection,
  handleCreateRaffleWithReferral,
  handleCreateRaffleWithoutReferral
} from "./scenes/add-raffle-actions";
import {
  handleReferralCode,
  handleCreateNewReferal,
  handleInputWalletPrompt,
  handleSelectWallet,
  handleWalletSelection,
} from "./scenes/referal-code";
import { importWalletScene } from "./scenes/importWalletScene";
import { generateWalletSeedScene } from "./scenes/generateWalletSeedScene";
import { importWalletStep } from "./scenes/importWalletScene";
import { chooseWalletNameStep } from "./scenes/chooseWalletNameScene";
import { generateWalletSeedStep } from "./scenes/generateWalletSeedScene";
import { btnDeleteWalletAction } from "./utils/bot-utils";
import { getWalletByName, dynamicDeleteWalletAction } from "./utils/bot-utils";
import { prevMessageState } from "./utils/state";
import { deletePreviousMessage } from "./utils/message-utils";
import {
  handleBuyTicket,
  handleLuckyCommand,
} from "./scenes/handle-lucky-command";
import { createRaffle } from "./utils/createRaffle";
import { handleMetamaskApplication } from "./scenes/add-raffle-actions";
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

bot.command("contract", async () => {
  await createRaffle();
});

// Handle the start command
bot.start(async (ctx) => {
  if (ctx.chat?.type.includes("group")) {
    return;
  }
  // Check if the user has blocked the bot
  const isBlocked = await checkBlockedUser(ctx, ctx.from.id);
  if (isBlocked) {
    // Stop further processing if the user has blocked the bot
    return;
  }

  try {
    prevMessageState.prevMessage = await ctx.reply(
      "Welcome to Lucky Dog Raffle Bot! Telegram's Original Buy Bot! What would you like to do today? \n/menu"
    );
  } catch (error) {
    // Handle errors that occur when sending messages
    console.error("Error while sending message:", error);
  }
});

// Additional handlers go here...

// General middleware to handle all types of actions
bot.use(async (ctx, next) => {
  const isBlocked = await checkBlockedUser(ctx, ctx.from.id);
  if (isBlocked) {
    return; // Stop further processing for blocked users
  }
  // Continue with the next middleware or handler
  await next();
});

// -----------------------  wallet setup start -----------------------------

// back buttons

bot.action("back-to-main-menu", async (ctx) => {
  ctx.deleteMessage();
  delete ctx.session.selectedDeleteWalletName;
  delete ctx.session.selectedPlayWalletName;
  delete ctx.session.selectedRefundWalletName;
  await menuCommand(ctx, ctx.session.wallets);
});

bot.command("menu", async (ctx) => {
  await menuCommand(ctx, ctx.session.wallets);
});

bot.command("wallets", async (ctx) => {
  await walletsCommand(ctx, ctx.session.wallets);
});

bot.action("wallets", async (ctx) => {
  ctx.deleteMessage();
  await walletsCommand(ctx, ctx.session.wallets);
});
bot.command("lucky", async (ctx) => {
  handleLuckyCommand(ctx, bot);
});

bot.action("metamask", async (ctx) => {
  await handleMetamaskApplication(ctx);
});

// create wallet buttons
bot.action("import-existing-wallet", (ctx) => {
  ctx.scene.enter(importWalletScene);
});

bot.action("generate-wallet-seed", (ctx) => {
  ctx.scene.enter(generateWalletSeedScene);
});

// delete buttons

bot.action("btn-delete-wallet", async (ctx) => {
  ctx.deleteMessage();
  await btnDeleteWalletAction(ctx, ctx.session.wallets);
});

bot.action(/^delete-wallet-/, async (ctx) => {
  ctx.deleteMessage();
  const walletName = ctx.update.callback_query.data.split("-")[2];
  ctx.session.selectedDeleteWalletName = walletName;
  const wallet = getWalletByName(ctx, walletName);
  await dynamicDeleteWalletAction(ctx, wallet);
});

bot.action("confirm-delete-wallet", async (ctx) => {
  ctx.deleteMessage();
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
  await handleReferralCode(ctx);
});

bot.action("create_new_referral", async (ctx) => {
  await handleCreateNewReferal(ctx);
});

bot.action("input_wallet_address", async (ctx) => {
  await handleInputWalletPrompt(ctx);
});

bot.action("select_wallet_address", async (ctx) => {
  await handleSelectWallet(ctx);
});

// Bot action to handle wallet selection from the inline keyboard
bot.action(/^select_wallet_/, async (ctx) => {
  const walletAddress = ctx.match.input.split("select_wallet_")[1]; // Extract wallet address from callback data

  if (!walletAddress) {
    ctx.reply("Failed to identify the selected wallet. Please try again.");
    return;
  }

  await handleWalletSelection(ctx, walletAddress);
});
// ----------------- referal code end -----------

// -------------- create raffle start ------------
// Handle the action when a wallet address is selected
bot.action(/^wallet_(.*)/, async (ctx) => {
  const walletAddress = ctx.match[1]; // Extract wallet address from callback data

  await ctx.reply(
    `Do you have any referral code?\nCreate with referral code, 2% service fee for bot and 0.5% referral fee for referrer.\nCreate without referral code, 3% service fee for bot.`,
    {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "Yes, I have a referral code",
              callback_data: `has_referral_${walletAddress}`,
            },
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
// Handle "Yes, I have a referral code"
bot.action(/^has_referral_(.*)/, async (ctx) => {
  const walletAddress = ctx.match[1]; // Extract wallet address from callback data
  await handleCreateRaffleWithReferral(ctx, walletAddress);
});
// Handle "No, continue without referral"
bot.action(/^no_referral_(.*)/, async (ctx) => {
  const walletAddress = ctx.match[1]; // Extract wallet address from callback data
  await handleCreateRaffleWithoutReferral(ctx, walletAddress);
});
// -------------- create raffle end ------------

// -----------------------adding bot to group-------------------
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

// Callback action handler for "ADD_RAFFLE"
bot.action("ADD_RAFFLE", async (ctx) => {
  try {
    if (prevMessageState.prevMessage) {
      deletePreviousMessage(ctx);
    }
    await handleAddRaffle(ctx);
  } catch (error) {
    ctx.reply("Failed to add raffle. Please try again.");
  }
});

bot.on("text", (ctx) => {
  if (prevMessageState.prevMessage) deletePreviousMessage(ctx);
  handleTextInputs(ctx);
});

// handle split percentage for raffle
bot.action("SPLIT_YES", (ctx) => {
  if (prevMessageState.prevMessage) deletePreviousMessage(ctx);
  handleSplitPool(ctx);
});

bot.action("SPLIT_NO", (ctx) => {
  if (prevMessageState.prevMessage) deletePreviousMessage(ctx);
  handleNoSplitPool(ctx);
});

// handle the raffle start time
bot.action("START_NOW", (ctx) => {
  if (prevMessageState.prevMessage) deletePreviousMessage(ctx);
  handleStartRaffleNow(ctx);
});

bot.action("SELECT_TIME", (ctx) => {
  if (prevMessageState.prevMessage) deletePreviousMessage(ctx);
  handleSelectTime(ctx);
});

// handle raffle limit
bot.action("TIME_BASED", (ctx) => {
  if (prevMessageState.prevMessage) deletePreviousMessage(ctx);
  handleTimeBasedLimit(ctx);
});

bot.action("VALUE_BASED", (ctx) => {
  if (prevMessageState.prevMessage) deletePreviousMessage(ctx);
  handleValueBasedLimit(ctx);
});

// confirm details
bot.action("CONFIRM_DETAILS", async (ctx) => {
  if (prevMessageState.prevMessage) deletePreviousMessage(ctx);
  handleConfirmDetails(ctx, ctx.session.wallets);
});

bot.action("CANCEL_ADD_RAFL", (ctx) => {
  if (prevMessageState.prevMessage) deletePreviousMessage(ctx);
  handleCancel(ctx);
});

bot.action(/buy_ticket_(\d+)_(\w+)/, async (ctx) => {
  handleBuyTicket(ctx);
});

// Connect to the database
connectDB();

if (process.env.NODE_ENV === "development") {
  bot.launch(() => {
    console.log("Bot is running in dev mode");
  });
} else if (process.env.NODE_ENV === "production") {
  const app = express();
  app.use(express.json());
  app.use(bot.webhookCallback("/secret-path"));
  bot.telegram.setWebhook(`${process.env.SERVER_URL}/secret-path`);
  // bot.telegram.setWebhook(
  //   `https://8bad-103-215-237-202.ngrok-free.app/secret-path`
  // );

  app.get("/", (req, res) => {
    res.send("Server is running");
  });
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

// Enable graceful stop
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
