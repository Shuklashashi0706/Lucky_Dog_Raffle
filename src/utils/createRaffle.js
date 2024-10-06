import { Wallet, ethers, Contract } from "ethers";
import { CHAIN, RAFFLE_ABI, RAFFLE_CONTRACT } from "../config";
import Raffle from "../models/raffle";
import { formatTime } from "./fortmat-date";
import { getWalletBalance } from "./contract-functions";
import GlobalMetrics from "../models/global-metrics";

const ZERO_WALLET_ADDRESS = "0x0000000000000000000000000000000000000000";
export const createRaffle = async (ctx, privateKey) => {
  const provider = new ethers.providers.JsonRpcProvider(
    CHAIN["sepolia"].rpcUrl
  );
  let wallet;

  if (ctx.session.mmstate === "add_raffle") {
    wallet = privateKey;
    ctx.session.currentWallet = await wallet.getAddress();
    // delete ctx.session.mmstate;
  } else {
    wallet = new Wallet(privateKey, provider);
    ctx.session.currentWallet = wallet.address;
  }
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
  const _referrer = ctx.session.referrer
    ? ctx.session.referrer
    : ZERO_WALLET_ADDRESS;
  const groupId = ctx.session.createdGroup;
  const groupName = ctx.session.createdGroupName;
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
      if (admin.toLowerCase() === ctx.session.currentWallet.toLowerCase()) {
        const raffleDetails = {
          raffleId: raffleId.toNumber(),
          raffleTitle: ctx.session.raffleTitle,
          groupId: groupId,
          groupName: groupName,
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
          await GlobalMetrics.updateOne(
            {},
            { $inc: { totalRegisteredUsers: 1 } },
            { upsert: true }
          );
          console.log("Raffle saved successfully");

          const message = await getRaffleDetailsMessage(raffleId);
          await ctx.telegram.sendMessage(groupId, message);
        } catch (dbError) {
          console.error("Error saving raffle to database:", dbError);
        }
      }
    }
  );
  try {
    await ctx.reply("Your transaction is being processed, please wait...");
    console.log("here1 ");
    let walletBalance;
    const gasEstimate = await contract.estimateGas.createRaffle(
      _entryCost,
      _raffleStartTime,
      _raffleEndTime,
      _maxTickets,
      _tgOwner,
      _tgOwnerPercentage,
      _maxBuyPerWallet,
      _referrer
    );
    console.log("here2");

    if (ctx.session.mmstate !== "add_raffle") {
      walletBalance = await getWalletBalance(wallet.address);
      const gasPrice = await wallet.provider.getGasPrice();
      const transactionCost = ethers.utils.formatEther(
        gasEstimate.mul(gasPrice)
      );
      if (walletBalance < transactionCost) {
        return await ctx.reply("Not enough balance to sign the transaction");
      }
    }

    if (ctx.session.mmstate === "add_raffle") {
      await ctx.reply("Open MetaMask to sign the transaction...");
    }
    const tx = await contract.createRaffle(
      _entryCost,
      _raffleStartTime,
      _raffleEndTime,
      _maxTickets,
      _tgOwner,
      _tgOwnerPercentage,
      _maxBuyPerWallet,
      _referrer,
      {
        maxFeePerGas: ethers.utils.parseUnits("30", "gwei"),
        maxPriorityFeePerGas: ethers.utils.parseUnits("25", "gwei"),
        gasLimit: ethers.utils.hexlify(500000),
      }
    );
    await ctx.reply(`Transaction sent: ${tx.hash}`);
    await ctx.reply(`Your transaction is getting mined, please wait...`);

    const receipt = await tx.wait(1, { timeout: 180000 });

    await ctx.reply(`Transaction mined: ${receipt.transactionHash}`);
    await ctx.reply("Raffle is created successfully ✨");
    ctx.session.mmstate = null;
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
