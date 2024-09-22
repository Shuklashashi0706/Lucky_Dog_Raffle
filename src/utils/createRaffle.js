import { Wallet, ethers, Contract } from "ethers";
import { CHAIN, RAFFLE_ABI, RAFFLE_CONTRACT } from "../config";
import Raffle from "../models/raffle"; // Import your Raffle model
import axios from "axios";
import Raffle from "../models/raffle";

export const createRaffle = async (ctx, privateKey) => {
  console.log(ctx.session.raffleTitle);
  console.log(ctx.session.ticketPrice);
  const provider = new ethers.providers.JsonRpcProvider(
    CHAIN["sepolia"].rpcUrl
  );

  if (!privateKey) {
    ctx.reply(
      "Private key is not defined...just for testing purpose ...remove it"
    );
  }
  const wallet = new Wallet(privateKey, provider);
  const userState = ctx.session.userState || {};

  const {
    rafflePrice = ethers.utils.parseEther("0.01"),
    startTime = Math.floor(Date.now() / 1000) + 3600,
    raffleEndValue = Math.floor(Date.now() / 1000) + 86400, // Default end time (24 hours from now)
    splitPool,
    maxBuyPerWallet = 10,
    referrer = ethers.constants.AddressZero,
  } = userState;

  const userKey = Object.keys(userState)[0];
  const userDetails = userState[userKey] || {};
  const { createdGroup } = userDetails;

  const _maxTickets = 0; // Default to zero; adjust based on your application needs
  const _raffleEndTime = _maxTickets === 0 ? raffleEndValue : 0; // Set to zero if max tickets is used
  const _tgOwner = wallet.address;

  if (_tgOwner === ethers.constants.AddressZero) {
    ctx.reply(
      "TG owner cannot be a zero address. Please check the configuration."
    );
    return;
  }

  const _referrer = referrer;
  if (_referrer === wallet.address) {
    ctx.reply("Referrer cannot be the same as the raffle admin.");
    return;
  }

  const _tgOwnerPercentage = splitPool === "YES" ? 500 : 0;
  const _entryCost = rafflePrice;
  const _raffleStartTime = startTime;

  const contract = new Contract(RAFFLE_CONTRACT, RAFFLE_ABI, wallet);
  contract.on(
    "RaffleCreated",
    async (raffleId, admin, entryCost, raffleEndTime, maxTickets) => {
      const raffleDetails = {
        raffleId: raffleId.toNumber(), // Convert BigNumber to number
        admin: admin,
        entryCost: ethers.utils.formatEther(entryCost), // Format to Ether
        raffleStartTime: _raffleStartTime,
        raffleEndTime: raffleEndTime.toNumber(),
        maxTickets: maxTickets.toNumber(),
        tgOwner: _tgOwner,
        tgOwnerPercentage: _tgOwnerPercentage,
        maxBuyPerWallet: maxBuyPerWallet,
        referrer: _referrer,
        isActive: true,
        groupId: createdGroup,
      };
      try {
        const newRaffle = new Raffle(raffleDetails);
        await newRaffle.save();
        console.log("Raffle saved successfully");
      } catch (dbError) {
        console.error("Error saving raffle to database:", dbError);
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
      maxBuyPerWallet,
      referrer
    );

    await ctx.reply(`Transaction sent: ${tx.hash}`);
    await ctx.reply(`Your transaction is getting mined, please wait...`);
    // Listen for the 'RaffleCreated' event

    const receipt = await tx.wait();

    await ctx.reply(`Transaction mined: ${receipt.transactionHash}`);
    await ctx.reply("Raffle is created successfully ✨");

    // Send a message to the group using the Telegram API
    const botIDAndToken = process.env.LOCAL_TELEGRAM_BOT_TOKEN;
    const message = "Raffle is created successfully ✨";

    if (createdGroup) {
      const telegramApiUrl = `https://api.telegram.org/bot${botIDAndToken}/sendMessage?chat_id=${createdGroup}&text=${encodeURIComponent(
        message
      )}`;
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
