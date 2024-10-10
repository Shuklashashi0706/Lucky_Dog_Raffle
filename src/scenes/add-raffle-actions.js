const { Scenes, Markup } = require("telegraf");
const { BaseScene } = Scenes;
import Group from "../models/group";
import Referral from "../models/referal";
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
import { getWalletBalance } from "../utils/contract-functions";
import { commandValidation, isCommand } from "../utils/message-utils";
export const raffleScene = new BaseScene("raffleScene");
let previousMessage;

function parseTime(timeString) {
  const timeMatch = timeString.match(/^(\d+d\s)?(\d+(\.\d+)?)h$/);
  const days = timeMatch[1]
    ? parseInt(timeMatch[1].replace("d", "").trim(), 10)
    : 0;
  const hours = parseFloat(timeMatch[2]);
  return days * 24 + hours; // Convert total time to hours for comparison
}

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
        const chat = await ctx.telegram.getChat(groupId);
        ctx.session.createdGroupName = chat.title;
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
        "Add bot to group",
        `https://t.me/${ctx.botInfo.username}?startgroup=true&admin=change_info+delete_messages+restrict_members+invite_users+pin_messages+manage_topics+manage_video_chats+promote_members`
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

raffleScene.enter(async (ctx) => {
  ctx.reply("Enter raffle title:");
});

raffleScene.on("text", (ctx) => {
  if (isCommand(ctx)) return;
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
  if (isCommand(ctx)) return;
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
  if (isCommand(ctx)) return;
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
  if (isCommand(ctx)) return;
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
  try {
    if (isCommand(ctx)) return;
    const input = ctx.message.text;
    const validation = startTimeSchema.safeParse(input);
    if (!validation.success) {
      return ctx.reply(validation.error.errors[0].message);
    }
    ctx.session.startTime = input;
    ctx.scene.enter("raffleLimitScene");
  } catch (error) {
    console.error("Error during text processing:", error);
    ctx.reply(
      "An error occurred while processing the start time. Please make sure the format is correct and try again."
    );
  }
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
  try {
    if (isCommand(ctx)) return;
    const input = ctx.message.text;

    if (ctx.session.raffleLimitType === "time_based") {
      const validation = startTimeSchema.safeParse(input);
      if (!validation.success) {
        return ctx.reply(validation.error.errors[0].message);
      }

      const startTime =
        ctx.session.startTime === "now"
          ? parseTime("0d 0h")
          : parseTime(ctx.session.startTime);
      const raffleLimit = parseTime(input);
      if (raffleLimit <= startTime) {
        return ctx.reply(
          "Raffle limit time must be greater than the start time. Please enter a valid time."
        );
      }
    } else if (ctx.session.raffleLimitType === "value_based") {
      const validation = raffleLimitSchema.safeParse(input);
      if (!validation.success) {
        return ctx.reply(validation.error.errors[0].message);
      }
    }

    ctx.session.raffleLimit = input;
    ctx.scene.enter("maxTicketsSingleUserCanBuy");
  } catch (error) {
    console.error("Error during raffle limit processing:", error);
    ctx.reply(
      "An error occurred while processing the raffle limit. Please try again."
    );
  }
});

const maxTicketsSingleUserCanBuy = new BaseScene("maxTicketsSingleUserCanBuy");
maxTicketsSingleUserCanBuy.enter((ctx) => {
  ctx.reply("What is the max amount of tickets a single user can buy?");
});

maxTicketsSingleUserCanBuy.on("text", (ctx) => {
  if (isCommand(ctx)) return;
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
  if (isCommand(ctx)) return;
  const input = ctx.message.text;

  const validation = raffleDescriptionSchema.safeParse(input);
  if (!validation.success) {
    return ctx.reply(validation.error.errors[0].message);
  }

  ctx.session.raffleDescription = input;
  ctx.scene.enter("confirmScene");
});

export const confirmScene = new BaseScene("confirmScene");

confirmScene.enter(async (ctx) => {
  try {
    const parseTimeToUTC = (timeString) => {
      const now = new Date();
      const [days, hours] = timeString.split(" ").map((part) => parseInt(part));
      const totalHours = days * 24 + hours;
      const futureDate = new Date(now.getTime() + totalHours * 60 * 60 * 1000);
      return futureDate.toUTCString();
    };

    let startTimeUTC;
    if (ctx.session.startTime === "now") {
      startTimeUTC = parseTimeToUTC("0d 0h");
    } else {
      startTimeUTC = parseTimeToUTC(ctx.session.startTime);
    }
    parseTimeToUTC(ctx.session.startTime);
    let raffleLimitUTC;
    if (ctx.session.raffleLimitType === "time_based") {
      raffleLimitUTC = parseTimeToUTC(ctx.session.raffleLimit);
    } else {
      raffleLimitUTC = ctx.session.raffleLimit;
    }

    const details = `
Raffle Title: ${ctx.session.raffleTitle}
Ticket Price: ${ctx.session.ticketPrice}
ETH Split: ${
      ctx.session.split
        ? `Yes (${ctx.session.splitPercent}%)\nSplit Address: ${ctx.session.walletAddress}`
        : "No"
    }
Raffle Start Time: ${startTimeUTC}
Raffle Limit: ${raffleLimitUTC}
Raffle Description/Purpose: ${ctx.session.raffleDescription}
    `;

    await ctx.reply(
      `Confirm raffle details:\n${details}`,
      Markup.inlineKeyboard([
        [Markup.button.callback("☑️ Confirm and Create", "confirm")],
        [Markup.button.callback("❌ Cancel", "cancel")],
      ])
    );
  } catch (error) {
    console.error("Error confirming raffle details:", error);
    await ctx.reply(
      "There was an error displaying raffle details. Please try again."
    );
  }
});

confirmScene.action("confirm", async (ctx) => {
  await ctx.deleteMessage();
  const wallets = ctx.session.wallets;

  if (wallets && wallets.length) {
    const walletButtons = await Promise.all(
      wallets.map(async (wallet, index) => {
        const balance = await getWalletBalance(wallet.address);
        const formattedAddress = `${wallet.address.slice(
          0,
          5
        )}...${wallet.address.slice(-4)}`;

        const formattedBalance = balance
          ? `(${parseFloat(balance).toFixed(2)} ETH)`
          : "(0.00 ETH)";

        return [
          {
            text: `${formattedAddress} ${formattedBalance}`,
            callback_data: `wallet_${wallet.address}`,
          },
        ];
      })
    );

    walletButtons.push([
      {
        text: "Metamask (BETA)",
        callback_data: "metamask_add_raffle",
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
      text: "Metamask (BETA)",
      callback_data: "metamask_add_raffle",
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

export const handleCreateRaffleWithReferral = new BaseScene(
  "handleCreateRaffleWithReferral"
);

// Function to handle creating a raffle with a referral
handleCreateRaffleWithReferral.enter(async (ctx) => {
  const chatId = ctx.chat?.id.toString();
  const walletAddress = ctx.session.referralSelectedWalletAddress;
  if (chatId) {
    ctx.session.walletAddress = walletAddress;
    await ctx.reply("Enter your referral code:");
  }
});

handleCreateRaffleWithReferral.on("text", async (ctx) => {
  try {
    const ReferralCode = ctx.message.text;
    const selectedWalletAddress = ctx.session.referralSelectedWalletAddress;

    const referral = await Referral.findOne({ referralCode: ReferralCode });

    if (referral) {
      if (referral.walletAddress === selectedWalletAddress) {
        await ctx.reply(
          "You cannot use the same referral code associated with the wallet used to create the raffle."
        );
      } else {
        try {
          const wallet = getWalletByAddress(ctx, selectedWalletAddress);
          const privateKey = decrypt(wallet.privateKey);
          ctx.session.referrer = referral.walletAddress;
          await createRaffle(ctx, privateKey);
          await ctx.reply("Raffle created successfully!");
        } catch (walletError) {
          console.error("Error during wallet processing:", walletError);
          await ctx.reply(
            "There was an error processing your wallet. Please try again later."
          );
        }
      }
    } else {
      // Referral code is invalid, show the options
      previousMessage = await ctx.reply(
        "Referral code is invalid.",
        Markup.inlineKeyboard([
          [Markup.button.callback("Enter Again", "enter_again")],
          [
            Markup.button.callback(
              "Proceed without referral code",
              "proceed_without_referral"
            ),
          ],
        ])
      );
    }
  } catch (error) {
    console.error("Error during referral process:", error);
    await ctx.reply("An unexpected error occurred. Please try again later.");
  }
});

handleCreateRaffleWithReferral.action("enter_again", async (ctx) => {
  if (previousMessage) await ctx.deleteMessage(previousMessage.message_id);
  await ctx.scene.enter("handleCreateRaffleWithReferral");
});

// Handle 'Proceed without referral code' button action
handleCreateRaffleWithReferral.action(
  "proceed_without_referral",
  async (ctx) => {
    if (previousMessage) await ctx.deleteMessage(previousMessage.message_id);
    const walletAddress = ctx.session.referralSelectedWalletAddress;
    await handleCreateRaffleWithoutReferral(ctx, walletAddress);
  }
);

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
  handleCreateRaffleWithReferral,
];
