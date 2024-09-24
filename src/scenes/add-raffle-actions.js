const { Scenes, Markup } = require("telegraf");
const { BaseScene } = Scenes;
import Group from "../models/group";
import {
  maxTicketsSchema,
  raffleDescriptionSchema,
  raffleLimitSchema,
  raffleTitleSchema,
  splitPercentSchema,
  startTimeSchema,
  ticketPriceSchema,
  walletAddressSchema,
} from "../types/input-validation";
import { getWalletByAddress } from "../utils/bot-utils";
import { createRaffle } from "../utils/createRaffle";
import { decrypt } from "../utils/encryption-utils";
export const raffleScene = new BaseScene("raffleScene");
let previousMessage;

raffleScene.enter(async (ctx) => {
  ctx.reply("Enter raffle title:");
});
raffleScene.on("text", (ctx) => {
  const input = ctx.message.text;
  const validation = raffleTitleSchema.safeParse(input);
  if (!validation.success) {
    return ctx.reply(validation.error.errors[0].message);
  }

  ctx.session.raffleTitle = input;
  ctx.scene.enter("ticketPriceScene");
});

const ticketPriceScene = new BaseScene("ticketPriceScene");
ticketPriceScene.enter((ctx) => {
  ctx.reply("Enter ticket price(ETH):");
});
ticketPriceScene.on("text", (ctx) => {
  const input = ctx.message.text;

  const validation = ticketPriceSchema.safeParse(input);
  if (!validation.success) {
    return ctx.reply(validation.error.errors[0].message);
  }

  ctx.session.ticketPrice = input;
  ctx.scene.enter("splitScene");
});

const splitScene = new BaseScene("splitScene");
splitScene.enter((ctx) => {
  previousMessage = ctx.reply(
    "Do you want to have a split of the raffle pool?",
    Markup.inlineKeyboard([
      Markup.button.callback("☑️ Yes", "split_yes"),
      Markup.button.callback("❌ No", "split_no"),
    ])
  );
});

splitScene.action("split_yes", async (ctx) => {
  await ctx.sendMessage("You selected to split the raffle pool");
  await ctx.deleteMessage(previousMessage.message_id);
  ctx.session.split = true;
  ctx.scene.enter("splitDetailsScene");
});

splitScene.action("split_no", async (ctx) => {
  await ctx.sendMessage("You selected NOT to split the raffle pool");
  await ctx.deleteMessage(previousMessage.message_id);
  ctx.session.split = false;
  ctx.scene.enter("startTimeScene");
});

const splitDetailsScene = new BaseScene("splitDetailsScene");
splitDetailsScene.enter((ctx) => {
  ctx.reply("Enter the split % for owner (integer, less than 39%):");
});

splitDetailsScene.on("text", (ctx) => {
  const input = ctx.message.text;

  const validation = splitPercentSchema.safeParse(input);
  if (!validation.success) {
    return ctx.reply(validation.error.errors[0].message);
  }

  ctx.session.splitPercent = input;
  ctx.scene.enter("askSplitWalletScene");
});

const askSplitWalletScene = new BaseScene("askSplitWalletScene");
askSplitWalletScene.enter((ctx) => {
  ctx.reply("Enter the wallet address to receive the share:");
});

askSplitWalletScene.on("text", (ctx) => {
  const input = ctx.message.text;

  const validation = walletAddressSchema.safeParse(input);
  if (!validation.success) {
    return ctx.reply(validation.error.errors[0].message);
  }

  ctx.session.walletAddress = input;
  ctx.scene.enter("startTimeScene");
});

const startTimeScene = new BaseScene("startTimeScene");
startTimeScene.enter((ctx) => {
  previousMessage = ctx.reply(
    "Set raffle start time:",
    Markup.inlineKeyboard([
      [Markup.button.callback("🙌 Now", "start_now")],
      [Markup.button.callback("🕰️ Select time", "select_time")],
    ])
  );
});

startTimeScene.action("start_now", async (ctx) => {
  await ctx.sendMessage("You selected to start the raffle now");
  await ctx.deleteMessage(previousMessage.message_id);
  ctx.session.startTime = "now";
  ctx.scene.enter("raffleLimitScene");
});

startTimeScene.action("select_time", async (ctx) => {
  await ctx.deleteMessage(previousMessage.message_id);
  ctx.reply("Enter start time in days and hours (e.g., 2d 3h):");
});

startTimeScene.on("text", (ctx) => {
  const input = ctx.message.text;

  const validation = startTimeSchema.safeParse(input);
  if (!validation.success) {
    return ctx.reply(validation.error.errors[0].message);
  }

  ctx.session.startTime = input;
  ctx.scene.enter("raffleLimitScene");
});

const raffleLimitScene = new BaseScene("raffleLimitScene");
raffleLimitScene.enter((ctx) => {
  ctx.reply(
    "Set raffle limit:",
    Markup.inlineKeyboard([
      [Markup.button.callback("⏱️ Time based", "time_based")],
      [Markup.button.callback("#️⃣ Value based", "value_based")],
    ])
  );
});

raffleLimitScene.action("time_based", async (ctx) => {
  await ctx.sendMessage("You selected time based raffle limit");
  await ctx.deleteMessage(previousMessage.message_id);
  ctx.session.raffleLimitType = "time_based";
  ctx.reply("Enter end time (e.g., 2d 3h):");
});

raffleLimitScene.action("value_based", async (ctx) => {
  await ctx.sendMessage("You selected value based raffle limit");
  await ctx.deleteMessage(previousMessage.message_id);
  ctx.session.raffleLimitType = "value_based";
  ctx.reply("Enter number of tickets:");
});

raffleLimitScene.on("text", (ctx) => {
  const input = ctx.message.text;

  if (ctx.session.raffleLimitType === "time_based") {
    const validation = startTimeSchema.safeParse(input);
    if (!validation.success) {
      return ctx.reply(validation.error.errors[0].message);
    }
  } else if (ctx.session.raffleLimitType === "value_based") {
    const validation = raffleLimitSchema.safeParse(input);
    if (!validation.success) {
      return ctx.reply(validation.error.errors[0].message);
    }
  }

  ctx.session.raffleLimit = input;
  ctx.scene.enter("maxTicketsSingleUserCanBuy");
});

const maxTicketsSingleUserCanBuy = new BaseScene("maxTicketsSingleUserCanBuy");
maxTicketsSingleUserCanBuy.enter((ctx) => {
  ctx.reply("What is the max amount of tickets a single user can buy?");
});

maxTicketsSingleUserCanBuy.on("text", (ctx) => {
  const input = ctx.message.text;

  const validation = maxTicketsSchema.safeParse(input);
  if (!validation.success) {
    return ctx.reply(validation.error.errors[0].message);
  }
  if (
    ctx.session.raffleLimitType === "value_based" &&
    Number(ctx.session.raffleLimit) < Number(input)
  ) {
    return ctx.reply(
      `Maximum number of tickets per wallet must be less than ${ctx.session.raffleLimit}(Raffle Limit)`
    );
  }

  ctx.session.maxTicketsSingleUserCanBuy = input;
  ctx.scene.enter("rafflePurposeScene");
});

const rafflePurposeScene = new BaseScene("rafflePurposeScene");
rafflePurposeScene.enter((ctx) => {
  ctx.reply("Add raffle purpose or description:");
});

rafflePurposeScene.on("text", (ctx) => {
  const input = ctx.message.text;

  const validation = raffleDescriptionSchema.safeParse(input);
  if (!validation.success) {
    return ctx.reply(validation.error.errors[0].message);
  }

  ctx.session.raffleDescription = input;
  ctx.scene.enter("confirmScene");
});

export const confirmScene = new BaseScene("confirmScene");
confirmScene.enter((ctx) => {
  const details = `
Raffle Title: ${ctx.session.raffleTitle}
Ticket Price: ${ctx.session.ticketPrice}ETH
Split: ${
    ctx.session.split
      ? `Yes (${ctx.session.splitPercent}%)\nSplit Address:${ctx.session.walletAddress}`
      : "No"
  }
Raffle Start Time: ${ctx.session.startTime}
Raffle Limit: ${ctx.session.raffleLimit}
Raffle Description/Purpose: ${ctx.session.raffleDescription}
  `;
  ctx.reply(
    `Confirm raffle details:\n${details}`,
    Markup.inlineKeyboard([
      [Markup.button.callback("☑️ Confirm and Create", "confirm")],
      [Markup.button.callback("❌ Cancel", "cancel")],
    ])
  );
});

confirmScene.action("confirm", async (ctx) => {
  await ctx.deleteMessage();
  const wallets = ctx.session.wallets;
  if (wallets && wallets.length) {
    const walletButtons = wallets.map((wallet, index) => {
      const formattedAddress = `${wallet.address.slice(
        0,
        5
      )}...${wallet.address.slice(-4)}`;
      return [
        {
          text: formattedAddress,
          callback_data: `wallet_${wallet.address}`,
        },
      ];
    });
    walletButtons.push([
      {
        text: "Metamask application",
        callback_data: "metamask",
      },
    ]);

    await ctx.reply("Please confirm your payment method", {
      reply_markup: {
        inline_keyboard: walletButtons,
      },
    });
  } else {
    const createWallet = {
      text: "Create Wallet",
      callback_data: "generate-wallet-seed",
    };
    const importWallet = {
      text: "Import Wallet",
      callback_data: "import-existing-wallet",
    };

    const metamaskApp = {
      text: "Metamask Application",
      callback_data: "metamask",
    };

    await ctx.reply("How would you like to complete the transaction?", {
      reply_markup: {
        inline_keyboard: [[createWallet], [importWallet], [metamaskApp]],
      },
    });
    ctx.session.needsPaymentConfirmation = true;
  }
  ctx.scene.leave();
});

confirmScene.action("cancel", async (ctx) => {
  await ctx.deleteMessage();
  ctx.reply("Raffle creation cancelled.");
  ctx.scene.leave();
});

export const addRaffleScenes = [
  raffleScene,
  ticketPriceScene,
  splitScene,
  splitDetailsScene,
  startTimeScene,
  raffleLimitScene,
  rafflePurposeScene,
  confirmScene,
  maxTicketsSingleUserCanBuy,
  askSplitWalletScene,
];

export const handleCreateRaffleWithoutReferral = async (ctx, walletAddress) => {
  try {
    const wallet = getWalletByAddress(ctx, walletAddress);
    const privateKey = decrypt(wallet.privateKey);
    await createRaffle(ctx, privateKey);
  } catch (error) {
    console.error("Error creating raffle:", error);
    ctx.reply(
      "Failed to create raffle without the referral code. Please try again."
    );
  }
};

// Function to handle creating a raffle with a referral
export const handleCreateRaffleWithReferral = async (ctx, walletAddress) => {
  const chatId = ctx.chat?.id.toString();
  if (chatId) {
    if (state) {
      ctx.session.walletAddress = walletAddress;
      await ctx.reply("Enter your referral code:");
    }
  }
};

export const handleGroupSelection = async (ctx) => {
  await ctx.deleteMessage();
  const chatId = ctx.chat?.id.toString();

  if (chatId && ctx.callbackQuery && ctx.callbackQuery.data) {
    const callbackData = ctx.callbackQuery.data;

    if (callbackData.startsWith("SELECT_GROUP_")) {
      const groupId = callbackData.replace("SELECT_GROUP_", "");

      try {
        const selectedGroup = await Group.findOne({ groupId });

        if (!selectedGroup) {
          await ctx.reply(
            "Failed to find the selected group. Please try again."
          );
          return;
        }

        ctx.session.createdGroup = groupId;

        await ctx.reply(
          `You selected ${selectedGroup.groupUsername} for create/update raffle`
        );
        await ctx.reply(
          `What are you wanting to do for ${selectedGroup.groupUsername} group/channel today:`,
          Markup.inlineKeyboard([
            [
              Markup.button.callback(
                "Add a new Raffle",
                `ADD_RAFFLE_${groupId}`
              ),
            ],
            [
              Markup.button.callback(
                "Update running raffle",
                `UPDATE_RAFFLE_${groupId}`
              ),
            ],
            [
              Markup.button.callback(
                "View raffle details",
                `VIEW_RAFFLE_${groupId}`
              ),
            ],
          ])
        );
      } catch (error) {
        console.error("Error fetching selected group:", error);
        ctx.reply(
          "An error occurred while fetching the group. Please try again."
        );
      }
    } else {
      await ctx.reply("Failed to process group selection. Please try again.");
    }
  } else {
    await ctx.reply("Failed to process group selection. Please try again.");
  }
};

export const handleAddRaffle = async (ctx) => {
  const chatId = ctx.chat?.id.toString();
  const userId = ctx.from?.id.toString();

  if (chatId && userId) {
    try {
      const groups = await Group.find({ userId });

      const addBotDeepLink = Markup.button.url(
        "Add Bot to Group",
        `https://t.me/${ctx.botInfo.username}?startgroup=true`
      );

      if (groups.length === 0) {
        await ctx.reply(
          "No available groups found. Please add bot to group first.",
          Markup.inlineKeyboard([addBotDeepLink], { columns: 1 })
        );
        return;
      }
      const groupButtons = groups.map((group) =>
        Markup.button.callback(
          group.groupUsername,
          `SELECT_GROUP_${group.groupId}`
        )
      );
      groupButtons.push(addBotDeepLink);
      await ctx.reply(
        "Select the group to associate with the raffle or add the bot to a new group:",
        Markup.inlineKeyboard(groupButtons, { columns: 1 })
      );
    } catch (error) {
      console.error("Error fetching groups:", error);
      ctx.reply("Failed to retrieve groups. Please try again later.");
    }
  } else {
    ctx.reply("Unable to retrieve chat ID or User ID. Please try again.");
  }
};
