import Raffle from "../models/raffle";
import { Context, Markup, Telegraf } from "telegraf";

// export const handleLuckyCommand = async (ctx: Context) => {
//   try {
//     const groupId = ctx?.chat?.id;

//     const raffle = await Raffle.findOne({
//       createdGroup: groupId,
//       raffleStatus: "RUNNING",
//     });

//     if (!raffle) {
//       return ctx.reply("No raffle is currently running.");
//     }

//     return ctx.replyWithMarkdown(
//       `🎉 *Current Raffle: ${raffle.raffleTitle}* \n\n💰 *Prize*: ${raffle.rafflePrice} \n🎟 *Ticket Price*: ${raffle.rafflePrice} ETH`,
//       Markup.inlineKeyboard([
//         Markup.button.callback(
//           "Buy Ticket",
//           `buy_ticket_${ctx?.from?.id}_${raffle._id}`
//         ),
//       ])
//     );
//   } catch (error) {
//     console.error("Error fetching raffle:", error);
//     return ctx.reply("There was an error fetching the raffle details.");
//   }
// };

// export const handleBuyTicket = async (ctx: Context, bot: Telegraf) => {
//   try {
//     // Ensure callbackQuery exists and has data
//     if (ctx.callbackQuery && "data" in ctx.callbackQuery) {
//       const callbackData = ctx.callbackQuery.data;

//       // Example: "buy_ticket_123456_abc123"
//       const dataParts = callbackData.split("_"); // ["buy", "ticket", "userId", "raffleId"]

//       // Extract the userId and raffleId
//       const userId = dataParts[2]; // Extracted userId from callback data
//       const raffleId = dataParts[3]; // Extracted raffleId from callback data

//       // Fetch raffle details from MongoDB using raffleId
//       const raffle = await Raffle.findById(raffleId);

//       if (!raffle) {
//         await ctx.reply("Raffle not found.");
//         return;
//       }

//       // Create the payment details message
//       const paymentDetails = `To buy a ticket for *${raffle.raffleTitle}*, please send ${raffle.rafflePrice} ETH`;

//       // Send a DM to the user with the payment details
//       await ctx.telegram.sendMessage(userId, paymentDetails, {
//         parse_mode: "Markdown",
//       });

//       // Notify the user who clicked the button that payment details have been sent
//       await ctx.answerCbQuery("Payment details have been sent to your DMs.");
//     } else {
//       console.error("Callback query does not contain data");
//     }
//   } catch (error) {
//     console.error("Error processing buy ticket:", error);
//     await ctx.reply("Something went wrong. Please try again.");
//   }
// };
