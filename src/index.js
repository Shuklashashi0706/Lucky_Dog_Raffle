import dotenv from "dotenv";
import express from "express";
import { Telegraf, session, Scenes, Markup } from "telegraf";
import { menuCommand, walletsCommand } from "./utils/bot-utils";
import connectDB from "./utils/connect-db";
import Group from "./models/group";
import Raffle from "./models/raffle";
import {
  raffleScene,
  handleGroupSelection,
  addRaffleScenes,
  handleAddRaffle,
  handleCreateRaffleWithoutReferral,
  handleCreateRaffleWithReferral,
} from "./scenes/add-raffle-actions";
import { buyRaffleScene } from "./scenes/buy-raffle-scene";
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
  ...addRaffleScenes,
  buyRaffleScene,
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
    // Stop further processing if the user has blocked the bot
    return;
  }

  try {
    // Create inline keyboard buttons
    const keyboard = Markup.inlineKeyboard([
      [
        Markup.button.url(
          "Add bot to group",
          `https://t.me/${ctx.botInfo.username}?startgroup=true`
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
  await menuCommand(ctx, ctx.session.wallets);
});

// bot.command("menu", async (ctx) => {
//   await menuCommand(ctx, ctx.session.wallets);
// });

bot.command("wallets", async (ctx) => {
  await walletsCommand(ctx, ctx.session.wallets);
});

bot.action("wallets", async (ctx) => {
  if (prevMessageState.prevMessage) {
    await ctx.deleteMessage(prevMessageState.prevMessage.message_id);
  }
  await walletsCommand(ctx, ctx.session.wallets);
});

bot.action("metamask", async (ctx) => {
  if (prevMessageState.prevMessage) {
    await ctx.deleteMessage(prevMessageState.prevMessage.message_id);
  }
  await handleMetamaskApplication(ctx);
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
  await handleInputWalletPrompt(ctx);
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

// ----------------- referal code end -----------

// -------------- create raffle start ------------
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
  const walletAddress = ctx.match[1]; // Extract wallet address from callback data
  await handleCreateRaffleWithReferral(ctx, walletAddress);
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
  await ctx.reply("Add Raffle option selected");
  const groupId = ctx.match[1];
  ctx.session.groupId = groupId;
  ctx.scene.enter("raffleScene");
});

bot.action(/^UPDATE_RAFFLE_(.*)/, async (ctx) => {
  await ctx.deleteMessage();
});

bot.action(/^VIEW_RAFFLE_(.*)/, async (ctx) => {
  if (prevMessageState.prevMessage) {
    await ctx.deleteMessage(prevMessageState.prevMessage.message_id);
  }
  const groupId = ctx.match[1];
  // Handle the logic for viewing raffle details
  await ctx.reply(`Viewing raffle details for group ID: ${groupId}`);
});
// -----------------------adding bot to group end-------------------

// ---------------------------- buy raffle start------------------------------
bot.command("lucky", async (ctx) => {
  ctx.scene.enter("buyRaffleScene");
});
// ---------------------------- buy raffle end------------------------------

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

// Enable graceful stop
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
