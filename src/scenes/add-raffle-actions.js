import { Context, Markup } from "telegraf";
import Raffle from "../models/raffle";
import { formatDate } from "../utils/fortmat-date";
import { z } from "zod";
import { userStateSchema } from "../types/ask-raffle";
import { transact } from "../utils/mm-sdk";
import Group from "../models/group";
import { prevMessageState } from "../utils/state";
import { deletePreviousMessage } from "../utils/message-utils";
import { handleWalletAddressInput } from "./referal-code";
import { createRaffle } from "../utils/createRaffle";
import Referral from "../models/referal";
const userState = {};

// Function to format a message with borders
const formatMessage = (message) => {
  const lines = message.split("\n");
  const maxLength = Math.max(...lines.map((line) => line.length));
  const border = " ".repeat(maxLength + 4);
  const paddedLines = lines.map((line) => ` ${line.padEnd(maxLength)} `);
  return `${border}\n${paddedLines.join("\n")}\n${border}`;
};

// Validate user state against schema
export const validateUserState = (state) => {
  return userStateSchema.safeParse(state);
};

// Validate a specific field in the user state
const validateField = (field, value) => {
  const schema = userStateSchema.shape[field];
  const result = schema.safeParse(value);
  if (!result.success) {
    return result.error.errors[0].message;
  }
  return null;
};

// Handle the addition of a raffle
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
          formatMessage(
            "No available groups found. Please add bot to group first."
          ),
          Markup.inlineKeyboard([addBotDeepLink], { columns: 1 })
        );
        return;
      }

      let groupButtons = [];

      const selectedGroups = groups.map((group) =>
        Markup.button.callback(
          group.groupUsername,
          `SELECT_GROUP_${group.groupId}`
        )
      );

      groupButtons.push(addBotDeepLink);
      groupButtons.push(...selectedGroups);

      userState[chatId] = { stage: "AWAITING_GROUP_SELECTION" };

      prevMessageState.prevMessage = await ctx.reply(
        formatMessage(
          "Select the group to associate with the raffle or add the bot to a new group:"
        ),
        Markup.inlineKeyboard(groupButtons, { columns: 1 })
      );
    } catch (error) {
      console.error("Error fetching groups:", error);
      ctx.reply(
        formatMessage("Failed to retrieve groups. Please try again later.")
      );
    }
  } else {
    ctx.reply(
      formatMessage("Unable to retrieve chat ID or User ID. Please try again.")
    );
  }
};

// Function to check if callbackQuery is a DataCallbackQuery
const isDataCallbackQuery = (query) => {
  return "data" in query;
};

// Handle group selection
export const handleGroupSelection = (ctx) => {
  if (prevMessageState.prevMessage) deletePreviousMessage(ctx);
  const chatId = ctx.chat?.id.toString();

  if (chatId && ctx.callbackQuery && isDataCallbackQuery(ctx.callbackQuery)) {
    const callbackData = ctx.callbackQuery.data;

    if (callbackData.startsWith("SELECT_GROUP_")) {
      const groupId = callbackData.replace("SELECT_GROUP_", "");
      const state = userState[chatId];

      if (state && state.stage === "AWAITING_GROUP_SELECTION") {
        state.createdGroup = groupId;
        state.stage = "ASK_RAFFLE_TITLE";
        ctx.reply(formatMessage("Enter the Raffle Title:"));
      } else {
        ctx.reply(
          formatMessage("Unexpected error. Please start the process again.")
        );
      }
    } else {
      ctx.reply(
        formatMessage("Failed to process group selection. Please try again.")
      );
    }
  } else {
    ctx.reply(
      formatMessage("Failed to process group selection. Please try again.")
    );
  }
};

// Handle split pool selection
export const handleSplitPool = (ctx) => {
  const chatId = ctx.chat?.id.toString();
  if (chatId) {
    const state = userState[chatId];
    if (state) {
      state.splitPool = "YES";
      state.stage = "ASK_SPLIT_PERCENT";
      ctx.reply(
        formatMessage(
          "Please enter the split percentage for the owner (0-100):"
        )
      );
    }
  }
};

// Handle no split pool selection
export const handleNoSplitPool = async (ctx) => {
  const chatId = ctx.chat?.id.toString();
  if (chatId) {
    const state = userState[chatId];
    if (state) {
      state.splitPool = "NO";
      state.stage = "ASK_RAFFLE_START_TIME";
      prevMessageState.prevMessage = await ctx.reply(
        formatMessage("Set raffle start time:"),
        Markup.inlineKeyboard([
          [Markup.button.callback("🙌 Now", "START_NOW")],
          [Markup.button.callback("🕰️ Select time", "SELECT_TIME")],
        ])
      );
    }
  }
};

// Handle starting raffle now
export const handleStartRaffleNow = async (ctx) => {
  const chatId = ctx.chat?.id.toString();
  if (chatId) {
    const state = userState[chatId];
    if (state) {
      state.startTime = formatDate(new Date());
      state.startTimeOption = "NOW";
      ctx.reply(
        formatMessage("Your raffle will start as soon as it is created.")
      );
      state.stage = "ASK_RAFFLE_LIMIT";
      prevMessageState.prevMessage = await ctx.reply(
        formatMessage("Set raffle limit:"),
        Markup.inlineKeyboard([
          [Markup.button.callback("⏱️ Time based", "TIME_BASED")],
          [Markup.button.callback("#️⃣ Value based", "VALUE_BASED")],
        ])
      );
    }
  }
};

// Handle selecting a specific time for the raffle
export const handleSelectTime = (ctx) => {
  const chatId = ctx.chat?.id.toString();
  if (chatId) {
    const state = userState[chatId];
    if (state) {
      state.startTimeOption = "SELECT";
      state.stage = "ASK_RAFFLE_START_TIME";
      ctx.reply(
        formatMessage(
          "Enter the start date & time in this format DD-MM-YYYY HH:MM\nExample: 04-09-2024 15:06"
        )
      );
    }
  }
};

// Handle time-based raffle limit
export const handleTimeBasedLimit = (ctx) => {
  const chatId = ctx.chat?.id.toString();
  if (chatId) {
    const state = userState[chatId];
    if (state) {
      state.raffleLimitOption = "TIME_BASED";
      state.stage = "ASK_RAFFLE_END_TIME";
      ctx.reply(
        formatMessage(
          "Enter the end date & time in this format DD-MM-YYYY HH:MM\nExample: 04-09-2024 15:06"
        )
      );
    }
  }
};

// Handle value-based raffle limit
export const handleValueBasedLimit = (ctx) => {
  const chatId = ctx.chat?.id.toString();
  if (chatId) {
    const state = userState[chatId];
    if (state) {
      state.raffleLimitOption = "VALUE_BASED";
      state.stage = "ASK_RAFFLE_VALUE";
      ctx.reply(formatMessage("Enter the number of Tickets"));
    }
  }
};

// Handle confirmation of raffle details
export const handleConfirmDetails = async (ctx, wallets) => {
  if (wallets && wallets.length) {
    ctx.session.userState = userState;

    // Map wallets to individual button objects and place each button in its own array
    const walletButtons = wallets.map((wallet, index) => [
      {
        text: `${wallet.address}`,
        callback_data: `wallet_${wallet.address}`,
      },
    ]);

    // Add Metamask option as a separate row
    walletButtons.push([
      {
        text: "Metamask application",
        callback_data: "metamask",
      },
    ]);

    ctx.reply("Please confirm your payment method", {
      reply_markup: {
        inline_keyboard: walletButtons, // Each button is in its own row
      },
    });
  } else {
    // No wallets available, offer to create or import a wallet
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

    ctx.reply("How would you like to complete the transaction?", {
      reply_markup: {
        inline_keyboard: [[createWallet], [importWallet], [metamaskApp]],
      },
    });

    // Set session flag indicating need to confirm payment method after wallet operation
    ctx.session.needsPaymentConfirmation = true;
  }
};

// Function to handle creating a raffle with a referral
export const handleCreateRaffleWithReferral = async (ctx, walletAddress) => {
  createRaffle(ctx);
};

// Function to handle creating a raffle without a referral
export const handleCreateRaffleWithoutReferral = async (ctx, walletAddress) => {
  createRaffle(ctx);
};

export const handleMetamaskApplication = async (ctx) => {
  const chatId = ctx.chat?.id.toString();
  if (chatId) {
    const state = userState[chatId];
    if (state) {
      const validationResult = validateUserState(state);
      if (!validationResult.success) {
        ctx.reply(
          formatMessage(
            `Validation failed: ${validationResult.error.errors
              .map((e) => e.message)
              .join(", ")}`
          )
        );
        return;
      }

      const transaction = await transact(
        ctx,
        "0xd99FF85E7377eF02E6996625Ad155a2E4C63E7be"
      );
      if (transaction) {
        try {
          const raffle = new Raffle({
            createdBy: ctx.from?.username?.toString(),
            createdGroup: state.createdGroup,
            raffleTitle: state.raffleTitle,
            rafflePrice: state.rafflePrice,
            splitPool: state.splitPool,
            splitPercentage: state.splitPercentage || null,
            ownerWalletAddress: state.ownerWalletAddress || null,
            startTimeOption: state.startTimeOption,
            startTime: state.startTime,
            raffleLimitOption: state.raffleLimitOption,
            raffleEndTime: state.raffleEndTime || null,
            raffleEndValue: state.raffleEndValue || null,
            rafflePurpose: state.rafflePurpose,
            raffleStatus: "RUNNING",
          });

          await raffle.save();
          ctx.reply(formatMessage("Raffle successfully created! 🎉🎉"));
          delete userState[chatId];
        } catch (error) {
          console.error("Error saving raffle to MongoDB:", error);
          ctx.reply(
            formatMessage("Failed to create raffle. Please try again.")
          );
        }
      }
    }
  }
};

// Handle cancelling the raffle setup process
export const handleCancel = (ctx) => {
  const chatId = ctx.chat?.id.toString();
  if (chatId) {
    if (userState[chatId]) {
      ctx.reply(formatMessage("Operation canceled!!"));
      delete userState[chatId];
    } else {
      ctx.reply(formatMessage("Raffle already added"));
    }
  }
};

// Handle the input of the group ID
export const handleGroupIdInput = async (ctx) => {
  const chatId = ctx.chat?.id.toString();

  if (chatId && ctx.message) {
    const state = userState[chatId];

    if (state && state.stage === "ASK_GROUP_ID") {
      const groupId = ctx.message.chat.id.toString();

      try {
        const group = await Group.findOne({ groupId });

        if (!group) {
          ctx.reply(
            formatMessage(
              `Group ID "${groupId}" not found. Please enter a valid Group ID.`
            )
          );
          return;
        }

        state.createdGroup = groupId;
        state.stage = "ASK_RAFFLE_TITLE";
        ctx.reply(formatMessage("Enter the Raffle Title:"));
      } catch (error) {
        console.error("Error finding group:", error);
        ctx.reply(
          formatMessage(
            "An error occurred while looking up the group. Please try again."
          )
        );
      }
    }
  } else {
    ctx.reply(formatMessage("Unable to retrieve chat ID. Please try again."));
  }
};

// Handle text inputs from the user
export const handleTextInputs = async (ctx) => {
  const chatId = ctx.chat?.id.toString();

  //handling creation of referal
  if (ctx.session.awaitingWalletAddress) {
    await handleWalletAddressInput(ctx);
  }

  if (chatId) {
    const state = userState[chatId];
    if (state) {
      switch (state?.stage) {
        case "ASK_GROUP_ID":
          handleGroupIdInput(ctx);
          break;
        case "ASK_RAFFLE_TITLE":
          const titleError = validateField("raffleTitle", ctx.message?.text);
          if (titleError) {
            ctx.reply(
              formatMessage(
                `Error: ${titleError}. Please enter a valid raffle title.`
              )
            );
            return;
          }
          state.raffleTitle = ctx.message?.text;
          state.stage = "ASK_RAFFLE_PRICE";
          ctx.reply(formatMessage("Enter raffle Ticket Price(ETH):"));
          break;

        case "ASK_RAFFLE_PRICE":
          const price = Number(ctx.message.text);
          const priceError = validateField("rafflePrice", price);
          if (priceError) {
            ctx.reply(
              formatMessage(
                `Error: ${priceError}. Please enter a valid non-negative number for the price.`
              )
            );
            return;
          }
          state.rafflePrice = price;
          state.stage = "ASK_SPLIT_POOL";
          prevMessageState.prevMessage = await ctx.reply(
            formatMessage("Do you wish to have a split of the Raffle Pool?"),
            Markup.inlineKeyboard([
              [
                Markup.button.callback("☑️ Yes", "SPLIT_YES"),
                Markup.button.callback("❌ No", "SPLIT_NO"),
              ],
            ])
          );
          break;

        case "ASK_SPLIT_PERCENT":
          const splitPercent = Number(ctx.message.text);
          const splitPercentError = validateField(
            "splitPercentage",
            splitPercent
          );
          if (splitPercentError) {
            ctx.reply(
              formatMessage(
                `Error: ${splitPercentError}. Please enter a valid percentage between 0 and 100.`
              )
            );
            return;
          }
          state.splitPercentage = splitPercent;
          state.stage = "ASK_WALLET_ADDRESS";
          ctx.reply(
            formatMessage("Enter the wallet address to receive the share:")
          );
          break;

        case "ASK_WALLET_ADDRESS":
          const walletError = validateField(
            "ownerWalletAddress",
            ctx.message.text
          );
          if (walletError) {
            ctx.reply(
              formatMessage(
                `Error: ${walletError}. Please enter a valid Ethereum address.`
              )
            );
            return;
          }
          state.ownerWalletAddress = ctx.message.text;
          state.stage = "ASK_RAFFLE_START_TIME";
          prevMessageState.prevMessage = await ctx.reply(
            formatMessage("Set raffle start time:"),
            Markup.inlineKeyboard([
              [Markup.button.callback("🙌 Now", "START_NOW")],
              [Markup.button.callback("🕰️ Select time", "SELECT_TIME")],
            ])
          );
          break;

        case "ASK_RAFFLE_START_TIME":
          const startTimeError = validateField("startTime", ctx.message.text);
          if (startTimeError) {
            ctx.reply(
              formatMessage(
                `Error: ${startTimeError}. Please enter a valid date and time in the format DD-MM-YYYY HH:MM.`
              )
            );
            return;
          }
          state.startTime = ctx.message.text;
          state.stage = "ASK_RAFFLE_LIMIT";
          prevMessageState.prevMessage = await ctx.reply(
            formatMessage("Set raffle limit:"),
            Markup.inlineKeyboard([
              [Markup.button.callback("⏱️ Time based", "TIME_BASED")],
              [Markup.button.callback("#️⃣ Value based", "VALUE_BASED")],
            ])
          );
          break;

        case "ASK_RAFFLE_VALUE":
          const endValue = Number(ctx.message.text);
          const endValueError = validateField("raffleEndValue", endValue);
          if (endValueError) {
            ctx.reply(
              formatMessage(
                `Error: ${endValueError}. Please enter a valid non-negative number for the raffle limit.`
              )
            );
            return;
          }
          state.raffleEndValue = endValue;
          state.stage = "ASK_RAFFLE_PURPOSE";
          ctx.reply(formatMessage("Add raffle purpose or description:"));
          break;

        case "ASK_RAFFLE_END_TIME":
          const endTimeError = validateField("raffleEndTime", ctx.message.text);
          if (endTimeError) {
            ctx.reply(
              formatMessage(
                `Error: ${endTimeError}. Please enter a valid date and time in the format DD-MM-YYYY HH:MM.`
              )
            );
            return;
          }
          state.raffleEndTime = ctx.message.text;
          state.stage = "ASK_RAFFLE_PURPOSE";
          ctx.reply(formatMessage("Add raffle purpose or description:"));
          break;

        case "ASK_RAFFLE_PURPOSE":
          const purposeError = validateField("rafflePurpose", ctx.message.text);
          if (purposeError) {
            ctx.reply(
              formatMessage(
                `Error: ${purposeError}. Please enter a valid raffle description.`
              )
            );
            return;
          }
          state.rafflePurpose = ctx.message.text;
          const validationResult = validateUserState(state);
          if (!validationResult.success) {
            ctx.reply(
              formatMessage(
                `Validation failed: ${validationResult.error.errors
                  .map((e) => e.message)
                  .join(", ")}`
              )
            );
            return;
          }
          const summaryMessage = formatMessage(`Raffle Title: ${
            state.raffleTitle
          }
Raffle Ticket Price: ${state.rafflePrice}ETH
${
  state.splitPool == "YES"
    ? `Split Raffle Pool: Yes
Split Percentage for Owner: ${state.splitPercentage}%
Wallet Address: ${state.ownerWalletAddress}`
    : `Split Raffle Pool: No`
}
Raffle Start Time: ${state.startTime}
${
  state.raffleLimitOption === "VALUE_BASED"
    ? `Raffle Limit Option: Value Based
Raffle Limit Value: ${state.raffleEndValue} Tickets`
    : `Raffle Limit Option: Time Based
Raffle End Time: ${state.raffleEndTime}`
}
Raffle Description/Purpose: ${state.rafflePurpose}`);

          prevMessageState.prevMessage = await ctx.reply(
            summaryMessage,
            Markup.inlineKeyboard([
              [
                Markup.button.callback(
                  "☑️ Confirm and Create",
                  "CONFIRM_DETAILS"
                ),
              ],
              [Markup.button.callback("❌ Cancel", "CANCEL_ADD_RAFL")],
            ])
          );
          break;

        default:
          ctx.reply(
            formatMessage("Unexpected input. Please start the process again.")
          );
          break;
      }
    }
  }
};
