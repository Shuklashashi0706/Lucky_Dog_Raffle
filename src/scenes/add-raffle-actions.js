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
import { getWalletByAddress } from "../utils/bot-utils";
import { decrypt } from "../utils/encryption-utils";
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

      const groupButtons = groups.map((group) =>
        Markup.button.callback(
          group.groupUsername,
          `SELECT_GROUP_${group.groupId}`
        )
      );

      // Add the deep link button to add bot to a new group
      groupButtons.push(addBotDeepLink);

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

// // Function to check if callbackQuery is a DataCallbackQuery
// const isDataCallbackQuery = (query) => {
//   return "data" in query;
// };

// Handle group selection
export const handleGroupSelection = async (ctx) => {
  await ctx.deleteMessage(prevMessageState.prevMessage.message_id);
  const chatId = ctx.chat?.id.toString();

  if (chatId && ctx.callbackQuery && ctx.callbackQuery.data) {
    const callbackData = ctx.callbackQuery.data;

    if (callbackData.startsWith("SELECT_GROUP_")) {
      const groupId = callbackData.replace("SELECT_GROUP_", "");
      const state = userState[chatId];

      if (state && state.stage === "AWAITING_GROUP_SELECTION") {
        try {
          const selectedGroup = await Group.findOne({ groupId });

          if (!selectedGroup) {
            await ctx.reply(
              "Failed to find the selected group. Please try again."
            );
            return;
          }

          state.createdGroup = groupId;
          state.stage = "GROUP_ACTION_SELECTION";
          await ctx.reply(`You selected ${selectedGroup.groupUsername} for create/update raffle`);
          prevMessageState.prevMessage = await ctx.reply(
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
        await ctx.reply("Unexpected error. Please start the process again.");
      }
    } else {
      await ctx.reply("Failed to process group selection. Please try again.");
    }
  } else {
    await ctx.reply("Failed to process group selection. Please try again.");
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
      state.startTime = "0d 0h";
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
      prevMessageState.prevMessage = ctx.reply(
        formatMessage(
          "Enter in days and hours after which you want to start.\nEg: 2d 5h"
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
          "Enter in days and hours after which you want to end.\n Eg: 2d 5h"
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

    // Map wallets to individual button objects and place each button in its own array (as a row)
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
      ]; // Wrapping each button inside an array to form a row
    });

    // Add Metamask option as a separate row (wrapped inside an array)
    walletButtons.push([
      {
        text: "Metamask application",
        callback_data: "metamask",
      },
    ]);

    // Send message with inline keyboard
    prevMessageState.prevMessage = await ctx.reply("Please confirm your payment method", {
      reply_markup: {
        inline_keyboard: walletButtons, // This will now be an array of arrays (rows)
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

    prevMessageState.prevMessage = await ctx.reply("How would you like to complete the transaction?", {
      reply_markup: {
        inline_keyboard: [[createWallet], [importWallet], [metamaskApp]], // Ensuring all buttons are wrapped in arrays (rows)
      },
    });

    // Set session flag indicating need to confirm payment method after wallet operation
    ctx.session.needsPaymentConfirmation = true;
  }
};

// ----------------------------------------
// Function to handle creating a raffle with a referral
export const handleCreateRaffleWithReferral = async (ctx, walletAddress) => {
  const chatId = ctx.chat?.id.toString();
  if (chatId) {
    const state = userState[chatId];
    if (state) {
      state.stage = "CREATE_RAFFLE";
      // Store the walletAddress in the user state for later use
      ctx.session.walletAddress = walletAddress;
      await ctx.reply("Enter your referral code:");
    }
  }
};

// Function to handle creating a raffle with referral input
export const handleCreateRaffleWithReferalInput = async (ctx) => {
  const referralCode = ctx.message.text;
  await ctx.reply("Validating your referral code, please wait...");
  const walletAddress = ctx.session.walletAddress;
  const wallet = getWalletByAddress(ctx, walletAddress);
  const privateKey = decrypt(wallet.privateKey);
  const isValid = await validateReferralCode(referralCode, ctx.from.id);
  if (isValid) {
    await createRaffle(ctx, privateKey);
  } else {
    await handleInvalidReferralCode(ctx);
  }
};

// Function to validate the referral code
export const validateReferralCode = async (referralCode, userId) => {
  try {
    const referral = await Referral.findOne({ userId, referralCode });
    return referral ? true : false;
  } catch (error) {
    console.error("Error validating referral code:", error);
    return false;
  }
};

// Function to handle raffle creation when referral code is valid
export const handleValidReferralCode = async (ctx) => {
  try {
    // Proceed with raffle creation using the valid referral code
    await createRaffle(ctx);
  } catch (error) {
    console.error("Error creating raffle:", error);
    ctx.reply(
      "Failed to create raffle with the referral code. Please try again."
    );
  }
};
// Function to handle invalid referral code response
export const handleInvalidReferralCode = async (ctx) => {
  ctx.reply("Referral code is invalid. Please choose an option:", {
    reply_markup: {
      inline_keyboard: [
        [{ text: "Enter again", callback_data: "enter_referral_again" }],
        [
          {
            text: "Proceed without referral code",
            callback_data: "proceed_without_referral",
          },
        ],
      ],
    },
  });
};
// --------------------------------------

// Function to handle creating a raffle without a referral code
export const handleCreateRaffleWithoutReferral = async (ctx, walletAddress) => {
  try {
    const wallet = getWalletByAddress(ctx, walletAddress);
    const privateKey = decrypt(wallet.privateKey);
    // Proceed with raffle creation without a referral code
    await createRaffle(ctx, privateKey); // Default referrer to zero address
  } catch (error) {
    console.error("Error creating raffle:", error);
    ctx.reply(
      "Failed to create raffle without the referral code. Please try again."
    );
  }
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

export const handleGroupIdInput = async (ctx, groupId) => {
  const chatId = ctx.chat?.id.toString();

  if (!chatId) {
    ctx.reply("Unable to retrieve chat ID. Please try again.");
    return;
  }

  const state = userState[chatId] || {};

  try {
    const group = await Group.findOne({ groupId });

    if (!group) {
      await ctx.reply(
        formatMessage(
          `Group ID "${groupId}" not found. Please enter a valid Group ID.`
        )
      );
      return;
    }

    state.createdGroup = groupId;
    state.stage = "ASK_RAFFLE_TITLE";
    userState[chatId] = state; 

    await ctx.reply(formatMessage("Enter the Raffle Title:"));
  } catch (error) {
    console.error("Error finding group:", error);

    if (error instanceof mongoose.Error.ValidationError) {
      ctx.reply(
        formatMessage(
          "Validation error occurred while looking up the group. Please ensure all information is correct."
        )
      );
    } else if (error.code === 11000) {
      // Duplicate key error (if applicable)
      ctx.reply("Duplicate entry found. Please ensure the group ID is unique.");
    } else {
      ctx.reply(
        formatMessage(
          "An unexpected error occurred while looking up the group. Please try again or contact support."
        )
      );
    }
  }
};

// Handle text inputs from the user
export const handleTextInputs = async (ctx) => {
  const chatId = ctx.chat?.id.toString();

  // Handling creation of referral
  if (ctx.session.awaitingWalletAddress) {
    await handleWalletAddressInput(ctx);
    return; // Early return to avoid further processing
  }

  if (chatId) {
    const state = userState[chatId];
    if (state) {
      switch (state?.stage) {
        case "CREATE_RAFFLE":
          await handleCreateRaffleWithReferalInput(ctx);
          break;

        case "ASK_GROUP_ID":
          await handleGroupIdInput(ctx);
          break;

        case "ASK_RAFFLE_TITLE":
          const titleError = validateField("raffleTitle", ctx.message?.text);
          if (titleError) {
            await ctx.reply(
              formatMessage(
                `Error: ${titleError}. Please enter a valid raffle title.`
              )
            );
            return;
          }
          state.raffleTitle = ctx.message?.text;
          state.stage = "ASK_RAFFLE_PRICE";
          await ctx.reply(formatMessage("Enter raffle Ticket Price (ETH):"));
          break;

        case "ASK_RAFFLE_PRICE":
          const price = Number(ctx.message.text);
          const priceError = validateField("rafflePrice", price);
          if (priceError) {
            await ctx.reply(
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
            await ctx.reply(
              formatMessage(
                `Error: ${splitPercentError}. Please enter a valid percentage between 0 and 100.`
              )
            );
            return;
          }
          state.splitPercentage = splitPercent;
          state.stage = "ASK_WALLET_ADDRESS";
          await ctx.reply(
            formatMessage("Enter the wallet address to receive the share:")
          );
          break;

        case "ASK_WALLET_ADDRESS":
          const walletError = validateField(
            "ownerWalletAddress",
            ctx.message.text
          );
          if (walletError) {
            await ctx.reply(
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
            await ctx.reply(
              formatMessage(
                `Error: ${startTimeError}. Please enter a valid date and time in the format 2d 5h.`
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
            await ctx.reply(
              formatMessage(
                `Error: ${endValueError}. Please enter a valid non-negative number for the raffle limit.`
              )
            );
            return;
          }
          state.raffleEndValue = endValue;
          state.stage = "ASK_RAFFLE_PURPOSE";
          await ctx.reply(formatMessage("Add raffle purpose or description:"));
          break;

        case "ASK_RAFFLE_END_TIME":
          const endTimeError = validateField("raffleEndTime", ctx.message.text);
          if (endTimeError) {
            await ctx.reply(
              formatMessage(
                `Error: ${endTimeError}. Please enter a valid date and time in the format Xd Yh.`
              )
            );
            return;
          }
          state.raffleEndTime = ctx.message.text;
          state.stage = "ASK_RAFFLE_PURPOSE";
          await ctx.reply(formatMessage("Add raffle purpose or description:"));
          break;

        case "ASK_RAFFLE_PURPOSE":
          const purposeError = validateField("rafflePurpose", ctx.message.text);
          if (purposeError) {
            await ctx.reply(
              formatMessage(
                `Error: ${purposeError}. Please enter a valid raffle description.`
              )
            );
            return;
          }
          state.rafflePurpose = ctx.message.text;
          const validationResult = validateUserState(state);
          if (!validationResult.success) {
            await ctx.reply(
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
          await ctx.reply(
            formatMessage("Unexpected input. Please start the process again.")
          );
          break;
      }
    }
  }
};

