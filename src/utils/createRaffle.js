import { Wallet, ethers, Contract } from "ethers";
import { CHAIN, RAFFLE_ABI, RAFFLE_CONTRACT } from "../config";
import Raffle from "../models/raffle"; // Import your Raffle model
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
  const userKey = Object.keys(userState)[0];
  const userDetails = userState[userKey] || {};
  console.log("user", userDetails);

  const {
    groupId,
    userId,
    botId,
    raffleTitle,
    rafflePrice,
    splitPool,
    startTime,
    startTimeOption,
    raffleLimitOption,
    raffleEndTime,
    raffleEndValue,
    rafflePurpose,
    splitPercentage,
    ownerWalletAddress,
  } = userDetails;
  const defaultAddress = "0xF27823f4A360d2372CeF4F5888D11D48F87AB312";
  const referrer = "0x5d90848338D967e01Ce077eDC7B0B08f8D694C44"; //need to be changed afterwards
  const maxBuyPerWallet = 2;
  if (rafflePrice <= 0) {
    throw new Error("Raffle price must be greater than 0.");
  }

  // 2. Validate splitPercentage (must be between 0 and 3900 basis points)
  if (splitPercentage < 0 || splitPercentage * 100 > 3900) {
    throw new Error("TG owner percentage cannot be more than 39.00%.");
  }

  // // 7. Validate referrer address (must not be the same as admin address)
  // if (referrer) {
  //   if (referrer === wallet.address) {
  //     // assuming 'wallet.address' is the admin address
  //     throw new Error("Referrer cannot be the same as the raffle admin.");
  //   }
  // }
  const raffleDetail = {
    // _entryCost: ethers.utils.parseUnits(rafflePrice.toString(), "ether"),
    _entryCost: ethers.utils.parseEther("0.01"),
    _raffleStartTime: Math.floor(startTime) + 3600, //adding 3600 so that while adding in contract , it is greater than current timestamp in contract
    _raffleEndTime: raffleEndTime || 0, // Set to 0 if not provided
    _maxTickets: raffleEndValue || 0, // Set to 0 if not provided
    _tgOwner: ownerWalletAddress || defaultAddress, // Use default if not provided
    _tgOwnerPercentage: splitPool === "YES" ? splitPercentage * 100 : 0,
    _maxBuyPerWallet: maxBuyPerWallet,
    _referrer: referrer,
  };
  const contract = new Contract(RAFFLE_CONTRACT, RAFFLE_ABI, wallet);
  // Function to get raffle details by raffleId
  async function getRaffleDetails(raffleId) {
    try {
      // Call the getRaffleDetails method
      const details = await contract.getRaffleDetails(raffleId);
      return details;
    } catch (error) {
      console.error(`Error fetching raffle details for ID ${raffleId}:`, error);
    }
  }

  // Function to get raffle details by raffleId and format message
  async function getRaffleDetailsMessage(raffleId) {
    try {
      // Call the getRaffleDetails method and await the result
      const details = await getRaffleDetails(raffleId);

      // Check if details are fetched successfully
      if (!details) {
        return `Error: Unable to fetch raffle details. Please try again later.`;
      }

      // Access the returned values directly from the object
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

      // Convert the entryCost from Wei to Ether for better readability
      const entryCostEther = ethers.utils.formatEther(entryCost);

      // Convert the raffleStartTime and raffleEndTime to readable date formats
      const raffleStartDate = new Date(raffleStartTime * 1000).toUTCString();
      const raffleEndDate =
        raffleEndTime > 0
          ? new Date(raffleEndTime * 1000).toUTCString()
          : "Not Applicable";

      // Format the message string with all details
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

  // Event listener for RaffleCreated
  contract.on(
    "RaffleCreated",
    async (raffleId, admin, entryCost, raffleEndTime, maxTickets) => {
      const raffleDetails = {
        raffleId: raffleId.toNumber(), // Convert BigNumber to number
        raffleTitle: raffleTitle,
        groupId: groupId,
        userId: userId,
        botId: botId,
        entryCost: ethers.utils.formatEther(entryCost), // Format to Ether
        raffleStartTime: raffleDetail._raffleStartTime,
        raffleEndTime: raffleEndTime.toNumber(),
        maxTickets: maxTickets.toNumber(),
        tgOwner: raffleDetail._tgOwner,
        tgOwnerPercentage: raffleDetail._tgOwnerPercentage,
        maxBuyPerWallet: raffleDetail._maxBuyPerWallet,
        referrer: raffleDetail._referrer,
        isActive: true,
      };
      try {
        const newRaffle = new Raffle(raffleDetails);
        await newRaffle.save();
        console.log("Raffle saved successfully");

        // Get the message details
        const message = await getRaffleDetailsMessage(raffleId);
        // const message = "Raffle saved successfully";

        // Send a message to the group using the Telegram API
        let botIDAndToken;
        if (process.env.NODE_ENV === "development") {
          botIDAndToken = process.env.LOCAL_TELEGRAM_BOT_TOKEN;
        } else {
          botIDAndToken = process.env.TELEGRAM_BOT_TOKEN;
        }

        if (groupId) {
          const telegramApiUrl = `https://api.telegram.org/bot${botIDAndToken}/sendMessage?chat_id=${parseInt(groupId)}&text=${encodeURIComponent(
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
      } catch (dbError) {
        console.error("Error saving raffle to database:", dbError);
      }
    }
  );

  try {
    await ctx.reply("Your transaction is being processed, please wait...");
    console.log("etherprice", raffleDetail._entryCost);

    const tx = await contract.createRaffle(
      raffleDetail._entryCost,
      raffleDetail._raffleStartTime,
      raffleDetail._raffleEndTime,
      raffleDetail._maxTickets,
      raffleDetail._tgOwner,
      raffleDetail._tgOwnerPercentage,
      raffleDetail._maxBuyPerWallet,
      raffleDetail._referrer
    );

    await ctx.reply(`Transaction sent: ${tx.hash}`);
    await ctx.reply(`Your transaction is getting mined, please wait...`);
    // Listen for the 'RaffleCreated' event

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
