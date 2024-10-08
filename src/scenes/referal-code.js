import Referral from "../models/referal"; // Import the Referral model
import { z } from "zod";
import { prevMessageState } from "../utils/state";
import { getWalletBalance } from "../utils/contract-functions";
import { Scenes } from "telegraf";
// Schema for validating Ethereum address using Zod
const walletAddressSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address");

// Function to generate a unique referral code in the format "LDGREF<counter><random>"
export const generateUniqueReferralCode = async () => {
  const prefix = "LDGREF";
  const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let suffix = 1;

  while (true) {
    // Generate a random 2-character string from the alphabet
    const randomChars = Array.from({ length: 2 }, () =>
      characters.charAt(Math.floor(Math.random() * characters.length))
    ).join("");

    // Combine the prefix, counter, and random characters to form the referral code
    const referralCode = `${prefix}${suffix}${randomChars}`;

    // Check if the generated referral code already exists in the database
    const existingCode = await Referral.findOne({ referralCode });
    if (!existingCode) {
      return referralCode; // Return the referral code if it doesn't exist
    }

    suffix++; // Increment the suffix to try the next number
  }
};
// Function to handle the display of referral codes and wallet addresses
export const handleReferralCode = async (ctx) => {
  try {
    const userId = ctx.from.id; // Fetch the user ID from the context

    // Fetch existing referral codes associated with the user's wallet addresses from the database
    const existingReferrals = await Referral.find({ userId });

    if (existingReferrals.length > 0) {
      // Prepare buttons showing existing referral codes and wallet addresses
      const referralButtons = existingReferrals.map((referral, i) => {
        // Format the wallet address to show the first 4 and last 4 characters
        const formattedAddress = `${referral.walletAddress.slice(
          0,
          5
        )}...${referral.walletAddress.slice(-4)}`;

        return [
          {
            text: `${referral.referralCode} - ${formattedAddress}`, // Display in "Referral Code - Formatted Wallet Address" format
            callback_data: `noop${i}`,
          },
        ];
      });

      // Add a button for creating a new referral
      referralButtons.push([
        {
          text: "Create new referral",
          callback_data: "create_new_referral",
        },
      ]);

      // Reply with the list of existing referrals and the option to create new ones
      prevMessageState.prevMessage = ctx.reply(
        "Your referral codes created in the past:",
        {
          reply_markup: {
            inline_keyboard: referralButtons,
          },
        }
      );
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
    prevMessageState.prevMessage = await ctx.reply(
      "How would you like to create a new referral?",
      {
        reply_markup: {
          inline_keyboard: inlineKeyboard,
        },
      }
    );
  } catch (error) {
    console.error("Error handling create new referral:", error);
    ctx.reply(
      "Failed to display options for creating a new referral. Please try again."
    );
  }
};

const askForWalletAddress = async (ctx) => {
  try {
    await ctx.reply("Enter your wallet address:");
    return ctx.wizard.next();
  } catch (error) {
    console.error("Error prompting wallet address input:", error);
    await ctx.reply("Failed to prompt for wallet address. Please try again.");
    return ctx.scene.leave();
  }
};

const handleWalletAddress = async (ctx) => {
  const message = ctx.message?.text;

  try {
    const validationResult = walletAddressSchema.safeParse(message);
    if (!validationResult.success) {
      await ctx.reply(
        `Error: ${validationResult.error.errors[0].message}. Please enter a valid Ethereum address.`
      );
      return; 
    }

    const walletAddress = validationResult.data;

    const existingReferral = await Referral.findOne({ walletAddress });
    if (existingReferral) {
      await ctx.reply(
        `This wallet address already has a referral code: ${existingReferral.referralCode}`
      );
      return ctx.scene.leave(); 
    }

    const referralCode = await generateUniqueReferralCode();

    const newReferral = new Referral({
      userId: ctx.from.id, 
      referralCode,
    });

    await newReferral.save();

    await ctx.reply(
      `Your referral code is "${referralCode}". Share this with your friends and get a 0.5% commission from the raffles they create.`
    );

    return ctx.scene.leave(); 
  } catch (error) {
    console.error("Error handling wallet address input:", error);
    await ctx.reply("Failed to create referral code. Please try again.");
    return ctx.scene.leave();
  }
};

export const walletReferralScene = new Scenes.WizardScene(
  "walletReferralScene",
  askForWalletAddress,
  handleWalletAddress 
);

// Function to handle selecting a wallet from the session and creating a referral code
export const handleSelectWallet = async (ctx) => {
  const { wallets } = ctx.session;

  try {
    const walletButtons =
      wallets && wallets.length > 0
        ? await Promise.all(
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
                  text: `Wallet ${
                    index + 1
                  }: ${formattedAddress} ${formattedBalance}`,
                  callback_data: `select_wallet_${wallet.address}`,
                },
              ];
            })
          )
        : [];

    const addWalletButton = [
      {
        text: "Add Wallet Address",
        callback_data: "wallets", // This will trigger the wallets callback to add a new wallet
      },
    ];

    // Add the "Add Wallet Address" button either as the last button or the only button if no wallets are present
    walletButtons.push(addWalletButton);

    ctx.session.selectWalletReferal = true;

    // Send the list of wallet addresses as a vertical inline keyboard, including the add wallet button
    prevMessageState.prevMessage = await ctx.reply(
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
