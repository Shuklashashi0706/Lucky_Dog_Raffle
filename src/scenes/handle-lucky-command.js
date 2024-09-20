import Raffle from "../models/raffle";
import {  Markup, Scenes } from "telegraf";
import { buyTickets } from "../utils/buyTickets";
import { getWalletByAddress } from "../utils/bot-utils";

export const luckyScene = new Scenes.BaseScene("LUCKY_SCENE");

luckyScene.enter(async (ctx) => {
  try {
    const groupId = ctx.chat.id;

    const raffle = await Raffle.findOne({
      createdGroup: groupId,
      raffleStatus: "RUNNING",
    });

    if (!raffle) {
      return ctx.reply("No raffle is currently running.");
    }

    return ctx.replyWithMarkdown(
      `🎉 *Current Raffle:* ${raffle.raffleTitle}\n💰 *Prize*: ${raffle.rafflePrice} \n🎟 *Ticket Price*: ${raffle.rafflePrice} ETH`,
      Markup.inlineKeyboard([
        Markup.button.callback(
          "Buy Ticket",
          `buy_ticket_${ctx?.from?.id}_${raffle._id}`
        ),
      ])
    );
  } catch (error) {
    console.error("Error fetching raffle:", error);
    return ctx.reply("There was an error fetching the raffle details.");
  }
});


luckyScene.action(/buy_ticket_(\d+)_(\w+)/, async (ctx) => {
  const walletAddress = ctx.session.wallets;
  console.log(walletAddress)
  const wallet = getWalletByAddress(ctx, walletAddress);
  // const privateKey = decrypt(wallet.privateKey);
  // const privateKey = "ff47cd585855776ead11b1870227a67f67f528c0ed12d4b8690ed2085a697954";
  buyTickets(ctx,privateKey,1)
  const callbackData = ctx.match; 
  const userId = callbackData[1];
  const raffleId = callbackData[2];

  const raffle = await Raffle.findById(raffleId);
  if (!raffle) {
    await ctx.reply("Raffle not found.");
    return;
  } 

  await ctx.telegram.sendMessage(
    userId,
    `You are purchasing a ticket from Group: ${raffle.createdGroup} RaffleTitle: ${raffle.raffleTitle}`,
    {
      parse_mode: "Markdown",
    }
  );
  await ctx.reply("How many tickets would you like to purchase?");
 
  ctx.scene.leave();
});