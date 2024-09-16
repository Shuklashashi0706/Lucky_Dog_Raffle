import { Wallet, ethers, Contract } from "ethers";
import { CHAIN, RAFFLE_ABI, RAFFLE_cONTRACT } from "../config";

export const createRaffle = async (ctx) => {
  const provider = new ethers.providers.JsonRpcProvider(
    CHAIN["sepolia"].rpcUrl
  );
  const wallet = new Wallet(
    "ab7ed858bafa191780d8ee80ddf049721a01e7db2708d6ae8977c1cfc9271ec9",
    provider
  );
  const userState = ctx.session.userState || {};

  // Destructuring userState with default values for missing fields
  const {
    rafflePrice = ethers.utils.parseEther("0.01"), // Default entry cost
    startTime = Math.floor(Date.now() / 1000) + 3600, // Default start time (1 hour from now)
    raffleEndValue = Math.floor(Date.now() / 1000) + 86400, // Default end time (24 hours from now)
    createdGroup, // Could map to _tgOwner
    splitPool, // For determining _tgOwnerPercentage, default if split is NO
    maxBuyPerWallet = 10, // Default max tickets per wallet
    referrer = ethers.constants.AddressZero, // Default no referrer
  } = userState;

  // Set either max tickets or raffle end time to zero based on your needs
  const _maxTickets = 0; // Default to zero; adjust based on your application needs
  const _raffleEndTime = _maxTickets === 0 ? raffleEndValue : 0; // Set to zero if max tickets is used

  // Ensure the TG owner is set correctly
  const _tgOwner = createdGroup || wallet.address;
  
  // Validate TG owner is not a zero address
  if (_tgOwner === ethers.constants.AddressZero) {
    ctx.reply("TG owner cannot be a zero address. Please check the configuration.");
    return;
  }

  // Ensure referrer and owner are not the same
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

  const contract = new Contract(RAFFLE_cONTRACT, RAFFLE_ABI, wallet);

  try {
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

    console.log("Transaction sent:", tx.hash);
    const receipt = await tx.wait();
    console.log("Transaction mined:", receipt.transactionHash);
    ctx.reply("Raffle is created successfully✨");
  } catch (error) {
    console.error("Error creating raffle:", error);
    if (error.reason) {
      ctx.reply(`Failed to create raffle: ${error.reason}`);
    } else {
      ctx.reply("Failed to create raffle. Please check input parameters and try again.");
    }
  }
};
