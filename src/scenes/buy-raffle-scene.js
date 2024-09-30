const { Scenes, Markup } = require("telegraf");
const { BaseScene } = Scenes;
import Raffle from "../models/raffle";
const { ethers } = require("ethers");
import EventEmitter from "events";
import { CHAIN, RAFFLE_ABI, RAFFLE_CONTRACT } from "../config";
import { EventEmitter } from "stream";

//for using raffleDetail buyRaffle
export const raffleDetailStore = new Map();

class BotEventEmitter extends EventEmitter {}
export const botEventEmitter = new BotEventEmitter();

let previousMessage;
export const buyRaffleScene = new BaseScene("buyRaffleScene");

buyRaffleScene.enter(async (ctx) => {
  const groupId = ctx?.chat.id;
  const userId = ctx.message.from.id;
  const unixTimestamp = Math.floor(Date.now() / 1000);
  const provider = new ethers.providers.JsonRpcProvider(
    CHAIN["sepolia"].rpcUrl
  );
  const contract = new ethers.Contract(RAFFLE_CONTRACT, RAFFLE_ABI, provider);

  previousMessage = await ctx.reply("🔍 Fetching raffle details...");

  if (ctx.chat.type === "supergroup" || ctx.chat.type === "group") {
    try {
      const raffle = await Raffle.findOne({ groupId, isActive: true });
      console.log(raffle);
      if (!raffle) {
        await ctx.deleteMessage(previousMessage.message_id);
        await ctx.reply("🚫 No raffle found for this group.");
        return;
      }

      const raffleDetails = await contract.getRaffleDetails(raffle.raffleId);
      const raffleId = raffle.raffleId;
      raffleDetailStore.set(userId, {
        raffle: raffleDetails,
        raffleId: raffleId,
        groupId: groupId,
      });
      const raffleStartTime = raffleDetails.raffleStartTime.toNumber();
      const raffleEndTime = raffleDetails.raffleEndTime.toNumber();
      const maxTickets = raffleDetails.maxTickets.toString();
      const ticketsSold = raffleDetails.ticketsSold.toString();
      const entryCost = ethers.utils.formatEther(raffleDetails.entryCost);

      // Check if the raffle is active and within the start time
      if (raffleDetails.isActive && raffleStartTime <= unixTimestamp) {
        await ctx.deleteMessage(previousMessage.message_id);

        let message = `🎉 *Running Raffle Details* 🎉\n\n`;
        message += `📛 *Title:* ${raffle.raffleTitle}\n`;
        message += `🆔 *Raffle ID:* ${raffle.raffleId}\n`;
        message += `💰 *Entry Cost:* ${entryCost} tokens\n\n`;
        message += `⏰ *Start Time:* ${new Date(
          raffleStartTime * 1000
        ).toLocaleString()}\n`;
        message += `⏳ *End Time:* ${
          raffleEndTime !== 0
            ? new Date(raffleEndTime * 1000).toLocaleString()
            : "No end time set"
        }\n`;
        message += `🎫 *Tickets Sold:* ${ticketsSold}\n`;
        message += `🎟️ *Max Tickets Allowed:* ${
          maxTickets !== "0" ? maxTickets : "Unlimited"
        }\n`;
        message += `🔄 *Max Buy Per Wallet:* ${raffleDetails.maxBuyPerWallet.toString()}\n`;
        message += `🏷️ *Referrer:* ${raffleDetails.referrer}\n`;

        // Save the group name and raffle title in the context session
        ctx.session.groupName = ctx.chat.title || "Group"; // Save group name (default to "Group" if undefined)
        ctx.session.raffleTitle = raffle.raffleTitle;

        // Send message with "Purchase Tickets" button
        await ctx.replyWithMarkdown(
          message,
          Markup.inlineKeyboard([
            Markup.button.callback(
              "🎟️ Purchase Tickets",
              `purchase_tickets_${ctx.from.id}`
            ),
          ])
        );
      } else {
        await ctx.deleteMessage(previousMessage.message_id);
        await ctx.reply(
          "⚠️ No active raffles at the moment or the raffle has ended."
        );
      }
    } catch (error) {
      await ctx.deleteMessage(previousMessage.message_id);
      console.error("Error fetching raffle:", error);
      await ctx.reply(
        "❌ An error occurred while fetching the raffle details. Please try again later."
      );
    }
  } else {
    await ctx.reply(
      "⚠️ Run this command in your group to find running raffle details."
    );
  }
});

// Action handler for "Purchase Tickets" button
buyRaffleScene.action(/^purchase_tickets_(\d+)$/, async (ctx) => {
  const userId = ctx.match[1]; // Extract the user ID from the callback data
  const groupName = ctx.session.groupName || "Group"; // Get the group name from the session
  const raffleTitle = ctx.session.raffleTitle || "Raffle"; // Get the raffle title from the session
  const raffleDetails = ctx.session.raffleDetails;
  try {
    // Send a private message to the user with the raffle details
    await ctx.telegram.sendMessage(
      userId,
      `🎫 You are purchasing tickets from:\n\n🏠 *Group Name:* ${groupName}\n🎉 *Raffle Title:* ${raffleTitle}`,
      { parse_mode: "Markdown" }
    );
    await ctx.answerCbQuery(
      `📩 Please check your DMs,${ctx.from.id}, to proceed with your ticket purchase! 🎟️`
    );
    const sentMessage = await ctx.reply(
      `📩 Please check your DMs,${ctx.from.id}, to proceed with your ticket purchase! 🎟️`
    );

    // Emit a custom event after sending the DM with user ID and group context
    botEventEmitter.emit("dmSent", { userId, ctx, raffleDetails });

    setTimeout(
      async () => await ctx.deleteMessage(sentMessage.message_id),
      10000
    );
  } catch (error) {
    console.error("Error sending private message:", error);
    await ctx.reply(
      "❌ Unable to send you a private message. Please make sure you have allowed messages from the bot."
    );
  }
});

export const buyRaffleScenes = [buyRaffleScene];
