const { Scenes, Markup } = require("telegraf");
const { BaseScene } = Scenes;
import Group from "../models/group";
import { getWalletByAddress } from "../utils/bot-utils";
import { createRaffle } from "../utils/createRaffle";
import { decrypt } from "../utils/encryption-utils";
export const raffleScene = new BaseScene("raffleScene");
let previousMessage;

raffleScene.enter(async (ctx) => {
  ctx.reply("Enter raffle title:");
});
raffleScene.on("text", (ctx) => {
  ctx.session.raffleTitle = ctx.message.text;
  ctx.scene.enter("ticketPriceScene");
});

const ticketPriceScene = new BaseScene("ticketPriceScene");
ticketPriceScene.enter((ctx) => {
  ctx.reply("Enter ticket price(ETH):");
});
ticketPriceScene.on("text", (ctx) => {
  ctx.session.ticketPrice = ctx.message.text;
  ctx.scene.enter("splitScene");
});

const splitScene = new BaseScene("splitScene");
splitScene.enter((ctx) => {
  previousMessage = ctx.reply(
    "Do you want to have a split of the raffle pool?",
    Markup.inlineKeyboard([
      Markup.button.callback("Yes", "split_yes"),
      Markup.button.callback("No", "split_no"),
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
  ctx.reply("Enter the split % for owner (integer, less than 25%):");
});
splitDetailsScene.on("text", (ctx) => {
  ctx.session.splitPercent = ctx.message.text;
  ctx.reply("Enter the wallet address to receive the share:");
});
splitDetailsScene.on("text", (ctx) => {
  ctx.session.walletAddress = ctx.message.text;
  ctx.scene.enter("startTimeScene");
});

const startTimeScene = new BaseScene("startTimeScene");
startTimeScene.enter((ctx) => {
  previousMessage = ctx.reply(
    "Set raffle start time:",
    Markup.inlineKeyboard([
      [Markup.button.callback("Now", "start_now")],
      [Markup.button.callback("Select time", "select_time")],
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
  ctx.session.startTime = ctx.message.text;
  ctx.scene.enter("raffleLimitScene");
});

const raffleLimitScene = new BaseScene("raffleLimitScene");
raffleLimitScene.enter((ctx) => {
  ctx.reply(
    "Set raffle limit:",
    Markup.inlineKeyboard([
      [Markup.button.callback("Time based", "time_based")],
      [Markup.button.callback("Value based", "value_based")],
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
  ctx.session.raffleLimit = ctx.message.text;
  ctx.scene.enter("maxTicketsSingleUserCanBuy");
});

const maxTicketsSingleUserCanBuy = new BaseScene("maxTicketsSingleUserCanBuy");
maxTicketsSingleUserCanBuy.enter((ctx) => {
  ctx.reply("What is the max amount of tickets single user can buy");
});
maxTicketsSingleUserCanBuy.on("text", (ctx) => {
  ctx.session.maxTicketsSingleUserCanBuy = ctx.message.text;
  ctx.scene.enter("rafflePurposeScene");
});

const rafflePurposeScene = new BaseScene("rafflePurposeScene");
rafflePurposeScene.enter((ctx) => {
  ctx.reply("Add raffle purpose or description:");
});
rafflePurposeScene.on("text", (ctx) => {
  ctx.session.raffleDescription = ctx.message.text;
  ctx.scene.enter("confirmScene");
});

export const confirmScene = new BaseScene("confirmScene");
confirmScene.enter((ctx) => {
  const details = `
Raffle Title: ${ctx.session.raffleTitle}
Ticket Price: ${ctx.session.ticketPrice}ETH
Split: ${ctx.session.split ? `Yes (${ctx.session.splitPercent}%)` : "No"}
Start Time: ${ctx.session.startTime}
Limit: ${ctx.session.raffleLimit}
Description: ${ctx.session.raffleDescription}
  `;
  ctx.reply(
    `Confirm raffle details:\n${details}`,
    Markup.inlineKeyboard([
      [Markup.button.callback("Confirm and Create", "confirm")],
      [Markup.button.callback("Cancel", "cancel")],
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
