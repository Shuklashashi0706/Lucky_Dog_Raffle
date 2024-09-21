import Raffle from "../models/raffle";
import { Markup, Scenes } from "telegraf";
import { buyTickets } from "../utils/buyTickets";
import { getWalletByAddress } from "../utils/bot-utils";
import { userStateSchema } from "../types/ask-raffle";
export const luckySceneState = {}
export const luckyScene = new Scenes.BaseScene("LUCKY_SCENE");

luckyScene.enter(async (ctx) => {
  try {
    const groupId = ctx.chat.id;
    const raffle = await Raffle.findOne({
      groupId: "-1002211654478",
      isActive: true,
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

export const handleBuyTicketAction = async (ctx) => {
  try {
    if (ctx.callbackQuery && "data" in ctx.callbackQuery) {
      const callbackData = ctx.callbackQuery.data;

      const dataParts = callbackData.split("_");

      const userId = dataParts[2];
      const raffleId = dataParts[3];

      const raffle = await Raffle.findById(raffleId);

      if (!raffle) {
        await ctx.reply("Raffle not found.");
        return;
      }

      ctx.session.raffleId = raffleId;
      ctx.session.userId = userId;
      ctx.session.waitingForTickets = true;
      if (!luckySceneState[ctx.from.id]) {
        luckySceneState[ctx.from.id] = {};  
      }
      luckySceneState[ctx.from.id].waitingForTickets = true;
      
      const ticketsMessage = `How many tickets would you like to purchase!!`;

      await ctx.telegram.sendMessage(userId, ticketsMessage, {
        parse_mode: "Markdown",
      });

      await ctx.answerCbQuery("Details have been sent to your DMs.");
    } else {
      console.error("Callback query does not contain data");
    }
  } catch (error) {
    console.error("Error processing buy ticket:", error);
    await ctx.reply("Something went wrong. Please try again.");
  }
};

