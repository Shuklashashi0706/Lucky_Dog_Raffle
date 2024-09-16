import Referral from "../models/referal"; // Import the Referral model
import { z } from "zod";

// Schema for validating Ethereum address using Zod
const walletAddressSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address");

// Function to generate a unique 5-character referral code
export const generateUniqueReferralCode = async () => {
  const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let referralCode;

  while (true) {
    referralCode = Array.from({ length: 5 }, () =>
      characters.charAt(Math.floor(Math.random() * characters.length))
    ).join("");

    const existingCode = await Referral.findOne({ referralCode });
    if (!existingCode) break;
  }

  return referralCode;
};

// Function to handle the display of referral codes and wallet addresses
export const handleReferralCode = async (ctx) => {
  try {
    const userId = ctx.from.id; // Fetch the user ID from the context

    // Fetch existing referral codes associated with the user's wallet addresses from the database
    const existingReferrals = await Referral.find({ userId });

    if (existingReferrals.length > 0) {
      // Prepare buttons showing existing referral codes and wallet addresses
      const referralButtons = existingReferrals.map((referral) => [
        {
          text: `${referral.referralCode} - ${referral.walletAddress}`, // Display in "Referral Code - Wallet Address" format
          callback_data: `wallet_${referral.walletAddress}`,
        },
      ]);

      // Add a button for creating a new referral
      referralButtons.push([
        {
          text: "Create new referral",
          callback_data: "create_new_referral",
        },
      ]);

      // Reply with the list of existing referrals and the option to create new ones
      ctx.reply("Your referral codes created in the past:", {
        reply_markup: {
          inline_keyboard: referralButtons,
        },
      });
    } else {
      // If no referrals exist, prompt directly to create a new one
      ctx.reply("No referral codes found. You can create a new referral:", {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "Create new referral",
                callback_data: "create_new_referral",
              },
            ],
          ],
        },
      });
    }
  } catch (error) {
    console.error("Error fetching referral data:", error);
    ctx.reply("Failed to fetch referral codes. Please try again.");
  }
};

export const handleCreateNewReferal = async (ctx) => {
  try {
    // Define buttons for "Input Wallet Address" and "Select Wallet Address"
    const inputWalletButton = {
      text: "Input Wallet Address",
      callback_data: "input_wallet_address",
    };

    const selectWalletButton = {
      text: "Select Wallet Address",
      callback_data: "select_wallet_address",
    };

    // Create an inline keyboard with buttons aligned vertically
    const inlineKeyboard = [[inputWalletButton], [selectWalletButton]];

    // Reply with the message and the inline keyboard
    await ctx.reply("How would you like to create a new referral?", {
      reply_markup: {
        inline_keyboard: inlineKeyboard,
      },
    });
  } catch (error) {
    console.error("Error handling create new referral:", error);
    ctx.reply(
      "Failed to display options for creating a new referral. Please try again."
    );
  }
};

// Function to handle input of wallet address
export const handleInputWalletPrompt = async (ctx) => {
  try {
    // Prompt the user to enter their wallet address
    await ctx.reply("Enter your wallet address:");
    // Set a flag or context to indicate that the bot is waiting for the wallet address input
    ctx.session.awaitingWalletAddress = true;
  } catch (error) {
    console.error("Error prompting wallet address input:", error);
    ctx.reply("Failed to prompt for wallet address. Please try again.");
  }
};

// Function to handle the actual input of wallet address and create a referral
export const handleWalletAddressInput = async (ctx) => {
  const chatId = ctx.chat?.id.toString();
  if (!chatId || !ctx.session.awaitingWalletAddress) {
    // Check if bot is awaiting wallet address input
    return; // Exit if the session is not expecting a wallet address
  }

  const message = ctx.message?.text;

  try {
    // Validate the wallet address using Zod
    const validationResult = walletAddressSchema.safeParse(message);
    if (!validationResult.success) {
      ctx.reply(
        `Error: ${validationResult.error.errors[0].message}. Please enter a valid Ethereum address.`
      );
      return;
    }

    const walletAddress = validationResult.data;

    // Check if the wallet address already has a referral code
    const existingReferral = await Referral.findOne({ walletAddress });
    if (existingReferral) {
      ctx.reply(
        `This wallet address already has a referral code: ${existingReferral.referralCode}`
      );
      return;
    }

    // Generate a unique 5-character referral code
    const referralCode = await generateUniqueReferralCode();

    // Create and save the new referral
    const newReferral = new Referral({
      userId: ctx.from.id, // Using Telegram user ID as userId
      walletAddress,
      referralCode,
    });

    await newReferral.save();
    ctx.reply(
      `Your referral code is "${referralCode}". Share this with your friends and get a 0.5% commission from the raffles they create.`
    );

    // Clear the session flag after processing
    ctx.session.awaitingWalletAddress = false;
  } catch (error) {
    console.error("Error handling wallet address input:", error);
    ctx.reply("Failed to create referral code. Please try again.");
  }
};

// Function to handle selecting a wallet from the session and creating a referral code
export const handleSelectWallet = async (ctx) => {
  const { wallets } = ctx.session;

  try {
    const walletButtons =
      wallets && wallets.length > 0
        ? wallets.map((wallet, index) => [
            {
              text: `Wallet ${index + 1}: ${wallet.address}`,
              callback_data: `select_wallet_${wallet.address}`,
            },
          ])
        : [];

    // Add a button for adding a new wallet address at the bottom
    const addWalletButton = [
      {
        text: "Add Wallet Address",
        callback_data: "wallets", // This will trigger the wallets callback to add a new wallet
      },
    ];

    // Add the "Add Wallet Address" button either as the last button or the only button if no wallets are present
    walletButtons.push(addWalletButton);

    // Send the list of wallet addresses as a vertical inline keyboard, including the add wallet button
    await ctx.reply(
      "Select a wallet to create a referral code, or add a new wallet address:",
      {
        reply_markup: {
          inline_keyboard: walletButtons,
        },
      }
    );
  } catch (error) {
    console.error("Error displaying wallets:", error);
    ctx.reply("Failed to display wallets. Please try again.");
  }
};

// Handler for creating referral code upon selecting a wallet
export const handleWalletSelection = async (ctx, walletAddress) => {
  try {
    // Check if the wallet address already has a referral code
    const existingReferral = await Referral.findOne({ walletAddress });
    if (existingReferral) {
      ctx.reply(
        `This wallet address already has a referral code: ${existingReferral.referralCode}`
      );
      return;
    }

    // Generate a unique 5-character referral code
    const referralCode = await generateUniqueReferralCode();

    // Create and save the new referral
    const newReferral = new Referral({
      userId: ctx.from.id, // Using Telegram user ID as userId
      walletAddress,
      referralCode,
    });

    await newReferral.save();
    ctx.reply(
      `Your referral code is "${referralCode}". Share this with your friends and get a 0.5% commission from the raffles they create.`
    );
  } catch (error) {
    console.error("Error generating referral code:", error);
    ctx.reply("Failed to create referral code. Please try again.");
  }
};
