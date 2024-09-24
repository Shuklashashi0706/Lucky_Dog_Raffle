import { Wallet, ethers, Contract } from "ethers";
import { CHAIN, RAFFLE_ABI, RAFFLE_CONTRACT } from "../config";
import Raffle from "../models/raffle";
import axios from "axios";
import Raffle from "../models/raffle";
import { formatTime } from "./fortmat-date";

const ZERO_WALLET_ADDRESS = "0x0000000000000000000000000000000000000000";
export const createRaffle = async (ctx, privateKey) => {
  const provider = new ethers.providers.JsonRpcProvider(
    CHAIN["sepolia"].rpcUrl
  );

  const wallet = new Wallet(privateKey, provider);

  const _entryCost = ethers.utils.parseEther(ctx.session.ticketPrice);
  const _raffleStartTime =
    ctx.session.startTime === "now" ? 0 : formatTime(ctx.session.startTime);
  const _raffleEndTime =
    ctx.session.raffleLimitType === "time_based"
      ? formatTime(ctx.session.raffleLimit)
      : 0;
  const _maxTickets =
    ctx.session.raffleLimitType === "value_based"
      ? Number(ctx.session.raffleLimit)
      : 0;
  const _tgOwner =
    ctx.session.split === true
      ? ctx.session.walletAddress
      : "0xF27823f4A360d2372CeF4F5888D11D48F87AB312";
  const _tgOwnerPercentage = ctx.session.splitPercent
    ? Number(ctx.session.splitPercent)
    : 0;
  const _maxBuyPerWallet = Number(ctx.session.maxTicketsSingleUserCanBuy);
  const _referrer = ZERO_WALLET_ADDRESS;
  const groupId = ctx.session.createdGroup;

  const contract = new Contract(RAFFLE_CONTRACT, RAFFLE_ABI, wallet);
  async function getRaffleDetails(raffleId) {
    try {
      const details = await contract.getRaffleDetails(raffleId);
      return details;
    } catch (error) {
      console.error(`Error fetching raffle details for ID ${raffleId}:`, error);
    }
  }
  async function getRaffleDetailsMessage(raffleId) {
    try {
      const details = await getRaffleDetails(raffleId);

      if (!details) {
        return `Error: Unable to fetch raffle details. Please try again later.`;
      }

      const {
        admin,
        tgOwner,
        winner,
        entryCost,
        raffleStartTime,
        raffleEndTime,
        maxTickets,
        isActive,
        tgOwnerPercentage,
        maxBuyPerWallet,
        referrer,
        ticketsSold,
      } = details;

      const entryCostEther = ethers.utils.formatEther(entryCost);
      const raffleStartDate = new Date(raffleStartTime * 1000).toUTCString();
      const raffleEndDate =
        raffleEndTime > 0
          ? new Date(raffleEndTime * 1000).toUTCString()
          : "Not Applicable";

      const message = `
Raffle Created Successfully ✨
-----------------------------------------
Raffle ID            : ${raffleId}
Admin                : ${admin}
TG Owner             : ${tgOwner}
Winner               : ${
        winner === "0x0000000000000000000000000000000000000000"
          ? "No Winner Yet"
          : winner
      }
Entry Cost           : ${entryCostEther} Ether
Raffle Start Time    : ${raffleStartDate}
Raffle End Time      : ${raffleEndDate}
Max Tickets          : ${maxTickets}
Is Active            : ${isActive ? "Yes" : "No"}
TG Owner Percentage  : ${(tgOwnerPercentage / 100).toFixed(2)}% 
Max Buy Per Wallet   : ${maxBuyPerWallet}
Referrer             : ${referrer}
Tickets Sold         : ${ticketsSold}
-----------------------------------------
Good luck to all participants! 🍀
`;

      return message;
    } catch (error) {
      console.error(`Error fetching raffle details for ID ${raffleId}:`, error);
      return `Error: Unable to fetch raffle details. Please try again later.`;
    }
  }
  contract.on(
    "RaffleCreated",
    async (raffleId, admin, entryCost, raffleEndTime, maxTickets) => {
      if (admin.toLowerCase() === wallet.address.toLowerCase()) {
        const raffleDetails = {
          raffleId: raffleId.toNumber(),
          raffleTitle: ctx.session.raffleTitle,
          groupId: groupId,
          userId: ctx.from.id,
          botId: 10, //temporary
          entryCost: ethers.utils.formatEther(entryCost),
          raffleStartTime: _raffleStartTime,
          raffleEndTime: raffleEndTime.toNumber(),
          maxTickets: maxTickets.toNumber(),
          tgOwner: _tgOwner,
          tgOwnerPercentage: _tgOwnerPercentage,
          maxBuyPerWallet: _maxBuyPerWallet,
          referrer: _referrer,
          isActive: true,
        };
        try {
          const newRaffle = new Raffle(raffleDetails);
          await newRaffle.save();
          console.log("Raffle saved successfully");

          const message = await getRaffleDetailsMessage(raffleId);

          let botIDAndToken;
          if (process.env.NODE_ENV === "development") {
            botIDAndToken = process.env.LOCAL_TELEGRAM_BOT_TOKEN;
          } else {
            botIDAndToken = process.env.TELEGRAM_BOT_TOKEN;
          }

          if (groupId) {
            const telegramApiUrl = `https://api.telegram.org/bot${botIDAndToken}/sendMessage?chat_id=${parseInt(
              groupId
            )}&text=${encodeURIComponent(message)}`;
            try {
              const res = await axios.get(telegramApiUrl);
              if (res.status === 200) {
                console.log("Message sent to the group successfully");
              } else {
                console.error("Failed to send message to the group:");
              }
            } catch (apiError) {
              console.error("Failed to send message to the group:", apiError);
            }
          } else {
            console.error("Group ID is undefined or invalid.");
            await ctx.reply("Group ID is undefined or invalid.");
          }
        } catch (dbError) {
          console.error("Error saving raffle to database:", dbError);
        }
      }
    }
  );
  try {
    await ctx.reply("Your transaction is being processed, please wait...");
    const tx = await contract.createRaffle(
      _entryCost,
      _raffleStartTime,
      _raffleEndTime,
      _maxTickets,
      _tgOwner,
      _tgOwnerPercentage,
      _maxBuyPerWallet,
      _referrer
    );
    await ctx.reply(`Transaction sent: ${tx.hash}`);
    await ctx.reply(`Your transaction is getting mined, please wait...`);

    const receipt = await tx.wait();

    await ctx.reply(`Transaction mined: ${receipt.transactionHash}`);
    await ctx.reply("Raffle is created successfully ✨");
  } catch (error) {
    console.error("Error creating raffle:", error);
    if (error.reason) {
      ctx.reply(`Failed to create raffle: ${error.reason}`);
    } else {
      ctx.reply(
        "Failed to create raffle. Please check input parameters and try again."
      );
    }
  }
};
