import axios from "axios";
export async function sendGroupMessage(chatId, message) {
  let botToken;
  console.log(process.env.NODE_ENV)
  if (process.env.NODE_ENV === "development") {
    botToken = process.env.LOCAL_TELEGRAM_BOT_TOKEN;
  } else {
    botToken = process.env.TELEGRAM_BOT_TOKEN;
  }
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  console.log(url);
  try {
    await axios.post(url, {
      chat_id: chatId,
      text: message,
    });
  } catch (error) {
    console.error("Error sending message to Telegram group:", error);
  }
}
