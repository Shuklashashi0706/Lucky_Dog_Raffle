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
        const timeRemaining = raffle.raffleEndTime - now;
        const minutes = Math.floor(timeRemaining / 60);
        const message = `Your Raffle with following details is ending in ${minutes} minutes\n
-----------------------------------------
Raffle ID            : ${raffle.raffleId}
Admin                : ${raffle.admin}
TG Owner             : ${raffle.tgOwner}
Entry Cost           : ${ethers.utils.formatEther(raffle.entryCost)} Ether
Raffle Start Time    : ${new Date(raffle.raffleStartTime * 1000).toUTCString()}
TG Owner Percentage  : ${(raffle.tgOwnerPercentage / 100).toFixed(2)}% 
Max Buy Per Wallet   : ${raffle.maxBuyPerWallet}
Referrer             : ${raffle.referrer}
-----------------------------------------`;
        await sendGroupMessage(raffle.userId, message);
      }
    } catch (error) {
      console.error("Error fetching raffles:", error);
    }
  });
};
