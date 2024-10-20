const { Scenes, Markup } = require("telegraf");
const { BaseScene } = Scenes;
import EventEmitter from "events";
import {
  deletePreviousMessage,
  previousMessages,
} from "../utils/message-utils";

class BotEventEmitter extends EventEmitter {}
export const configBotEventEmitter = new BotEventEmitter();

export const configGroupScene = new BaseScene("configGroupScene");

configGroupScene.enter(async (ctx) => {
  try {
    const userId = ctx.from?.id;
    if (!userId) {
      throw new Error("User ID not found");
    }
    const currentMessage = await ctx.reply("Processing your request...");
    previousMessages.set(userId, currentMessage);

    // Ensure ctx.chat is defined and check for group/supergroup
    if (
      !ctx.chat ||
      (ctx.chat?.type !== "group" && ctx.chat?.type !== "supergroup")
    ) {
      await deletePreviousMessage(ctx, userId);
      await ctx.reply(
        "This command can only be used in a group or supergroup."
      );
      return;
    }

    await deletePreviousMessage(ctx, userId);

    // Get administrators of the chat
    const chatAdmins = await ctx.telegram.getChatAdministrators(ctx.chat.id);
    const isAdmin = chatAdmins.some((admin) => admin.user.id === ctx.from.id);

    // Check if the user is an admin
    if (isAdmin) {
      const groupId = ctx.chat.id; // Pass the groupId into session
      ctx.session.groupId = groupId; // Store the groupId in the session

      // Send a reply with an inline button
      const mess = await ctx.reply(
        "Yes, you are an admin. Click 'Continue' to proceed.",
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: "Continue", callback_data: "continue_config" }],
            ],
          },
        }
      );
      previousMessages.set(userId, mess);
    } else {
      await ctx.reply("You are not an admin of this group.");
    }
  } catch (error) {
    // Handle errors and edge cases
    console.error("An error occurred:", error);
    await ctx.reply(
      "An error occurred while processing your request. Please try again."
    );
  }
});

configGroupScene.action("continue_config", async (ctx) => {
  try {
    const userId = ctx.from.id;
    const groupId = ctx.session.groupId;
    await deletePreviousMessage(ctx, userId);
    const chatAdmins = await ctx.telegram.getChatAdministrators(ctx.chat.id);
    const isAdmin = chatAdmins.some((admin) => admin.user.id === ctx.from.id);
    if (isAdmin) {
      configBotEventEmitter.emit("configMessageDmSent", {
        userId,
        ctx,
        groupId,
      });
    }
  } catch (error) {
    console.error(
      "An error occurred while processing the 'Continue' button:",
      error
    );
    await ctx.reply(
      "An error occurred while processing your request. Please try again."
    );
  }
});
