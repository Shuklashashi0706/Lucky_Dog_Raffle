import { Wallet, ethers, Contract } from "ethers";
import { CHAIN, RAFFLE_ABI,RAFFLE_CONTRACT } from "../config";

export const createRaffle = async (ctx,privateKey) => {
  const provider = new ethers.providers.JsonRpcProvider(
    CHAIN["sepolia"].rpcUrl
  );
  if(!privateKey){
    ctx.reply("Private key is not defined...just for testing purpose ...remove it")
  }
  const wallet = new Wallet(privateKey, provider);
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
    ctx.reply(
      "TG owner cannot be a zero address. Please check the configuration."
    );
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