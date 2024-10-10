import axios from "axios";
export async function sendGroupMessage(chatId, message) {
  let botToken;
  if (process.env.NODE_ENV === "development") {
    botToken = process.env.LOCAL_TELEGRAM_BOT_TOKEN;
  } else {
    botToken = process.env.TELEGRAM_BOT_TOKEN;
  }
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
 
  try {
    await axios.post(url, {
      chat_id: chatId,
      text: message,
    });
  } catch (error) {
    console.error("Error sending message to Telegram group:", error);
  }
}
