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
} from "./scenes/add-raffle-actions";
import { importWalletScene } from "./scenes/importWalletScene";
import { generateWalletSeedScene } from "./scenes/generateWalletSeedScene";
import { importWalletStep } from "./scenes/importWalletScene";
import { chooseWalletNameStep } from "./scenes/chooseWalletNameScene";
import { generateWalletSeedStep } from "./scenes/generateWalletSeedScene";
import { playAmountStep } from "./scenes/playAmountScene";
import { btnDeleteWalletAction } from "./utils/bot-utils";
import { getWalletByName, dynamicDeleteWalletAction } from "./utils/bot-utils";
import { prevMessageState } from "./utils/state";
import { deletePreviousMessage } from "./utils/message-utils";
import {
  handleBuyTicket,
  handleLuckyCommand,
} from "./scenes/handle-lucky-command";
dotenv.config();

if (!process.env.TELEGRAM_BOT_TOKEN) {
  console.error("Setup your token");
  process.exit(1);
}
const bot = new Telegraf("7518728844:AAEoJq_x2GZyn20GstLgbfskoCsWLLf3TGU");

const stage = new Scenes.Stage([
  importWalletStep,
  chooseWalletNameStep,
  generateWalletSeedStep,
  playAmountStep,
]);

bot.use(session());
bot.use(stage.middleware());

// Set up bot commands and actions
bot.start((ctx) => {
  prevMessageState.prevMessage = ctx.reply(
    "Welcome to Lucky Dog Raffle Bot! Telegram's Original Buy Bot! What would you like to do today? \n/menu",
    Markup.inlineKeyboard([
      Markup.button.callback("➕ Add a Raffle", "ADD_RAFFLE"),
    ])
  );
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

bot.command("wallets", async (ctx) => {
  console.log("wallet")
  await walletsCommand(ctx, ctx.session.wallets);
});

bot.command("lucky", async (ctx) => {
  console.log("lulcky")
   handleLuckyCommand(ctx , bot);
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

// adding bot to group
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

bot.action("ADD_RAFFLE", (ctx) => {
  if (prevMessageState.prevMessage) deletePreviousMessage(ctx);
  handleAddRaffle(ctx);
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
  handleConfirmDetails(ctx);
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

  app.get("/", (req, res) => {
    res.send("Server is running");
  });
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}
