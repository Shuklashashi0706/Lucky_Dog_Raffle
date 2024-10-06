import Raffle from "./models/raffle";
import { sendGroupMessage } from "./utils/sendGroupMessage";
import cron from "node-cron";
export const startRaffleCron = () => {
  cron.schedule("*/10 * * * *", async () => {
    const now = Math.floor(Date.now() / 1000);
    const tenMinutesLater = now + 10 * 60;

    try {
      const rafflesEndingSoon = await Raffle.find({
        isActive: true,
        raffleEndTime: { $lte: tenMinutesLater, $gt: now },
      });

      for (const raffle of rafflesEndingSoon) {
        await sendGroupMessage(
          raffle.userId,
          "Your Raffle Ending in 10 minutes"
        );
      }
    } catch (error) {
      console.error("Error fetching raffles:", error);
    }
  });
};
