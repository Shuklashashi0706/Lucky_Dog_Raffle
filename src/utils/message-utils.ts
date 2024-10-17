import { Context } from "telegraf";
import { prevMessageState } from "./state";

// Function to format messages
const formatMessage = (message: string): string => {
  const lines = message.split("\n");
  const maxLength = Math.max(...lines.map((line) => line.length));
  const border = " ".repeat(maxLength + 4);
  const paddedLines = lines.map((line) => ` ${line.padEnd(maxLength)} `);
  return `${border}\n${paddedLines.join("\n")}\n${border}`;
};
// Store previous messages per userId
const previousMessages = new Map<number, { message_id: number }>();

// Function to delete previous message for a specific user
const deletePreviousMessage = async function (
  ctx: Context,
  userId: number
): Promise<void> {
  const previousMessage = previousMessages.get(userId);
  if (previousMessage && previousMessage.message_id) {
    try {
      await ctx.deleteMessage(previousMessage.message_id);
      previousMessages.delete(userId); // Remove entry after deletion
    } catch (error) {
      console.error(
        `Failed to delete previous message for userId: ${userId}`,
        error
      );
    }
  }
};

const isCommand = (ctx: any) => {
  const input = ctx.message.text;
  switch (input) {
    case "/cancel":
      ctx.reply("Operation cancelled!");
      ctx.scene.leave();
      return 1;
    case "/start":
      ctx.reply("Operation cancelled!");
      ctx.scene.leave();
      return 1;
  }
};

export { deletePreviousMessage,previousMessages, formatMessage, isCommand };
