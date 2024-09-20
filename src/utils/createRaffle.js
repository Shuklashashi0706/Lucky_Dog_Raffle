import { Wallet, ethers, Contract } from "ethers";
import { CHAIN, RAFFLE_ABI, RAFFLE_CONTRACT } from "../config";
import axios from "axios";
import Raffle from "../models/raffle";
export const createRaffle = async (ctx, privateKey) => {
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

  // Destructuring userState with default values for missing fields
  const {
    rafflePrice = ethers.utils.parseEther("0.01"),
    startTime = Math.floor(Date.now() / 1000) + 3600, // Default start time (1 hour from now)
    raffleEndValue = Math.floor(Date.now() / 1000) + 86400, // Default end time (24 hours from now)
    splitPool, // For determining _tgOwnerPercentage, default if split is NO
    maxBuyPerWallet = 10, // Default max tickets per wallet
    referrer = ethers.constants.AddressZero, // Default no referrer
  } = userState;

  const userKey = Object.keys(userState)[0];
  const userDetails = userState[userKey] || {};
  const { createdGroup } = userDetails;

  const _maxTickets = 0; 
  const _raffleEndTime = _maxTickets === 0 ? raffleEndValue : 0; 

  // Ensure the TG owner is set correctly
  const _tgOwner = wallet.address;

  // Validate TG owner is not a zero address
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

  // Set TG owner percentage based on splitPool value
  const _tgOwnerPercentage = splitPool === "YES" ? 500 : 0; // 5% if splitPool is YES

  // Default values for other inputs
  const _entryCost = rafflePrice;
  const _raffleStartTime = startTime;

  const contract = new Contract(RAFFLE_CONTRACT, RAFFLE_ABI, wallet);

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

    // Notify the user of the transaction hash
    await ctx.reply(`Transaction sent: ${tx.hash}`);
    await ctx.reply(`Your transaction is getting mined , please wait.....`);
    const receipt = await tx.wait();
    // Notify the user that the transaction has been mined
    await ctx.reply(`Transaction mined: ${receipt.transactionHash}`);
    await ctx.reply("Raffle is created successfully ✨");

    // Send the message to the group using the Telegram API
    const botIDAndToken = process.env.LOCAL_TELEGRAM_BOT_TOKEN; // Ensure your bot token is stored in environment variables
    const message = "Raffle is created successfully ✨";

    const raffle = new Raffle({
      createdBy: ctx.from?.username?.toString(),
      createdGroup: state.createdGroup,
      raffleTitle: state.raffleTitle,
      rafflePrice: state.rafflePrice,
      splitPool: state.splitPool,
      splitPercentage: state.splitPercentage || null,
      ownerWalletAddress: state.ownerWalletAddress || null,
      startTimeOption: state.startTimeOption,
      startTime: state.startTime,
      raffleLimitOption: state.raffleLimitOption,
      raffleEndTime: state.raffleEndTime || null,
      raffleEndValue: state.raffleEndValue || null,
      rafflePurpose: state.rafflePurpose,
      raffleStatus: "RUNNING",
    });

    await raffle.save();

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
        console.error("Failed to send message to the group:");
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
