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

// Function to delete a previous message
const deletePreviousMessage = async (ctx: Context) => {
  try {
    if (prevMessageState.prevMessage) {
      await ctx.deleteMessage(prevMessageState.prevMessage.message_id);
      prevMessageState.prevMessage = undefined;
    }
  } catch (error) {
    console.error("Error deleting message:", error);
  }
};

export { deletePreviousMessage, formatMessage };