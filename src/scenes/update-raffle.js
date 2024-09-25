import Raffle from "../models/raffle";
import {
  endRaffle,
  getRaffleDetails,
  updateRaffle,
} from "../utils/contract-functions";
import { formatTime } from "../utils/fortmat-date";
import { ethers } from "ethers";
const { Scenes, Markup } = require("telegraf");
const { BaseScene } = Scenes;

export const updateRaffleScene = new BaseScene("updateRaffleScene");
updateRaffleScene.enter(async (ctx) => {
  const groupId = ctx.session.createdGroup;
  try {
    const raffle = await Raffle.findOne({
      groupId: groupId,
      isActive: true,
    }).select("raffleId");

    if (!raffle) {
      ctx.reply(
        "No raffle running in this group, start by creating one.",
        Markup.inlineKeyboard([
          Markup.button.callback("Add a new Raffle", `ADD_RAFFLE_${groupId}`),
        ])
      );
      ctx.scene.leave();
      return;
    }

    const raffleDetails = await getRaffleDetails(raffle.raffleId);
    if (!raffleDetails.isActive) {
      ctx.reply(
        "No raffle running in this group, start by creating one.",
        Markup.inlineKeyboard([
          Markup.button.callback("Add a new Raffle", `ADD_RAFFLE_${groupId}`),
        ])
      );
    } else {
      ctx.session.raffleId = raffle.raffleId;
      ctx.session.raffleDetails = raffleDetails;
      const message = `
Raffle Details ✨
-----------------------------------------
Raffle ID            : ${raffle.raffleId}
Admin                : ${raffleDetails.admin}
TG Owner             : ${raffleDetails.tgOwner}
Winner               : ${
        raffleDetails.winner === "0x0000000000000000000000000000000000000000"
          ? "No Winner Yet"
          : winner
      }
Entry Cost           : ${ethers.utils.formatEther(
        raffleDetails.entryCost
      )} Ether
Raffle Start Time    : ${new Date(
        raffleDetails.raffleStartTime * 1000
      ).toUTCString()}
${
  raffleDetails.raffleEndTime.toNumber() !== 0
    ? `Raffle End Time      : ${new Date(
        raffleDetails.raffleEndTime * 1000
      ).toUTCString()}`
    : `Max Tickets          : ${raffleDetails.maxTickets}`
}
Is Active            : ${raffleDetails.isActive ? "Yes" : "No"}
TG Owner Percentage  : ${(raffleDetails.tgOwnerPercentage / 100).toFixed(2)}% 
Max Buy Per Wallet   : ${raffleDetails.maxBuyPerWallet}
Referrer             : ${raffleDetails.referrer}
Tickets Sold         : ${raffleDetails.ticketsSold}
-----------------------------------------

`;
      await ctx.reply(message);
      let ownerWalletFlag = false;
      if (ctx.session.wallets) {
        ctx.session.wallets.map((wallet) => {
          if (wallet.address === raffleDetails.admin) {
            ownerWalletFlag = true;
          }
        });
      }
      ctx.session.adminWalletAddress = raffleDetails.admin;
      if (raffleDetails.raffleEndTime !== 0 && raffleDetails.maxTickets === 0) {
        ctx.session.timeBasedRaffle = true;
      } else {
        ctx.session.timeBasedRaffle = false;
      }
      if (!ownerWalletFlag) {
        ctx.reply(
          `We could not find the owner wallet ${raffleDetails.admin.slice(
            0,
            4
          )}....${raffleDetails.admin.slice(-4)} in this session.`,
          Markup.inlineKeyboard([
            [Markup.button.callback("Import wallet", `import-existing-wallet`)],
            [
              Markup.button.callback(
                "Use Metamask",
                `metamask_update_owner_check`
              ),
            ],
          ])
        );
      } else {
        ctx.scene.enter("timeBasedRaffle");
      }
    }
  } catch (err) {
    console.log(err.message);
    ctx.reply("Error fetching raffle details");
  }
});
const timeBasedRaffle = new BaseScene("timeBasedRaffle");

timeBasedRaffle.enter(async (ctx) => {
  if (ctx.session.timeBasedRaffle === false) {
    const isRaffleStarted = checkIfRaffleStarted(ctx);
    if (!isRaffleStarted) {
      ctx.reply(
        "What would you like to update?",
        Markup.inlineKeyboard([
          [Markup.button.callback("Update start time", "update_start_time")],
          [
            Markup.button.callback(
              "Update max tickets available",
              "update_max_tickets"
            ),
          ],
          [
            Markup.button.callback(
              "Update owner split status",
              "update_owner_split_status"
            ),
          ],
          [
            Markup.button.callback(
              "Update MAX purchase per wallet",
              "update_max_purchase_per_wallet"
            ),
          ],
        ])
      );
    } else {
      const ticketsPurchased = ctx.session.raffleDetails.ticketsSold;
      if (ticketsPurchased > 0) {
        ctx.reply(
          "The raffle has already started, you can only end it now.",
          Markup.inlineKeyboard([
            [Markup.button.callback("End Raffle", "end_raffle")],
          ])
        );
      } else {
        ctx.reply(
          "The raffle has already started, but there are no tickets purchased yet.",
          Markup.inlineKeyboard([
            [Markup.button.callback("End Raffle", "end_raffle")],
          ])
        );
      }
    }
  } else {
    const isRaffleStarted = checkIfRaffleStarted(ctx);
    if (!isRaffleStarted) {
      ctx.reply(
        "What would you like to update?",
        Markup.inlineKeyboard([
          [Markup.button.callback("Update Start time", "update_start_time")],
          [Markup.button.callback("Update End time", "update_end_time")],
          [
            Markup.button.callback(
              "Update owner split status",
              "update_owner_split_status"
            ),
          ],
          [
            Markup.button.callback(
              "Update MAX purchase per wallet",
              "update_max_purchase_per_wallet"
            ),
          ],
        ])
      );
    } else {
      const ticketsPurchased = ctx.session.raffleDetails.ticketsSold;
      if (ticketsPurchased > 0) {
        ctx.reply(
          "The raffle has already started, you can only end it now.",
          Markup.inlineKeyboard([
            [Markup.button.callback("End Raffle", "end_raffle")],
          ])
        );
      } else {
        ctx.reply(
          "The raffle has already started, but there are no tickets purchased yet.",
          Markup.inlineKeyboard([
            [Markup.button.callback("End Raffle", "end_raffle")],
          ])
        );
      }
    }
  }
});

timeBasedRaffle.action("end_raffle", async (ctx) => {
  await ctx.deleteMessage();
  const success = await endRaffle(ctx,ctx.session.raffleId);
  if (success) {
    ctx.reply("The raffle has been ended.");
  } else {
    ctx.reply("Failed to end the raffle");
  }
  ctx.scene.leave();
});

timeBasedRaffle.action(
  [
    "update_start_time",
    "update_end_time",
    "update_owner_split_status",
    "update_max_purchase_per_wallet",
    "update_max_tickets",
    "update_split_percentage",
    "update_owner_wallet_address",
  ],
  async (ctx) => {
    await ctx.deleteMessage();
    ctx.session.updateOption = ctx.callbackQuery.data;
    switch (ctx.session.updateOption) {
      case "update_start_time":
        ctx.reply("Enter new start time in the format Xd Yh (eg 2d 3h):");
        break;
      case "update_end_time":
        ctx.reply("Enter new end time in the format Xd Yh (eg 2d 3h):");
        break;
      case "update_owner_split_status":
        ctx.reply(
          "What do you wish to update",
          Markup.inlineKeyboard([
            [
              Markup.button.callback(
                "Split Percentage",
                "update_split_percentage"
              ),
            ],
            [
              Markup.button.callback(
                "Owner Wallet Address",
                "update_owner_wallet_address"
              ),
            ],
          ])
        );
        break;
      case "update_max_purchase_per_wallet":
        ctx.reply(
          "Enter new maximum amount of tickets allowed to be purchased per wallet:"
        );
        break;
      case "update_max_tickets":
        ctx.reply("Enter new maximum amount of tickets for raffle:");
        break;
      case "update_split_percentage":
        ctx.reply("Enter new split percentage:");
        break;
      case "update_owner_wallet_address":
        ctx.reply("Enter new owner wallet address:");
    }
  }
);

timeBasedRaffle.on("text", async (ctx) => {
  const raffleId = ctx.session.raffleId;
  switch (ctx.session.updateOption) {
    case "update_start_time":
      const newStartTime = ctx.message.text;
      await updateRaffle(
        ctx,
        raffleId,
        null,
        null,
        formatTime(newStartTime),
        null,
        null,
        null
      );
      await ctx.deleteMessage();
      break;
    case "update_end_time":
      const newEndTime = ctx.message.text;
      await updateRaffle(
        ctx,
        raffleId,
        null,
        formatTime(newEndTime),
        null,
        null,
        null,
        null
      );
      await ctx.deleteMessage();
      break;
    case "update_owner_split_status":
      ctx.reply("What do you wish to update");
      break;
    case "update_max_purchase_per_wallet":
      const newMaxBuyPerWallet = ctx.message.text;
      await updateRaffle(
        ctx,
        raffleId,
        null,
        null,
        null,
        Number(newMaxBuyPerWallet),
        null,
        null
      );
      await ctx.deleteMessage();
      break;
    case "update_max_tickets":
      const newMaxTickets = ctx.message.text;
      await updateRaffle(
        ctx,
        raffleId,
        Number(newMaxTickets),
        null,
        null,
        null,
        null,
        null
      );
      await ctx.deleteMessage();
      break;

    case "update_split_percentage":
      const newTgOwnerPercent = ctx.message.text;
      await updateRaffle(
        ctx,
        raffleId,
        null,
        null,
        null,
        null,
        null,
        Number(newTgOwnerPercent)
      );
      await ctx.deleteMessage();
      break;
    case "update_owner_wallet_address":
      const newTgOwner = ctx.message.text;
      await updateRaffle(
        ctx,
        raffleId,
        null,
        null,
        null,
        null,
        newTgOwner,
        null
      );
      await ctx.deleteMessage();
      break;
  }
  ctx.scene.leave();
});

export const updateRaffleScenes = [updateRaffleScene, timeBasedRaffle];

const checkIfRaffleStarted = (ctx) => {
  const startTime = new Date(ctx.session.raffleDetails.raffleStartTime * 1000);

  const currentTime = new Date();

  if (startTime <= currentTime) {
    return 1;
  } else {
    return 0;
  }
};
