import { Markup, Scenes } from "telegraf";
import { raffleDetailStore } from "../scenes/buy-raffle-scene.js";
import { CHAIN, RAFFLE_ABI, RAFFLE_CONTRACT } from "../config";
import { Wallet, ethers, Contract } from "ethers";
import axios from "axios";
import { getWalletByAddress } from "./bot-utils.js";
import { decrypt } from "./encryption-utils";
import GlobalMetrics from "../models/global-metrics";

export const raffleDetail = new Map();

export const handleBuyRaffle = async (ctx) => {
  await ctx.scene.enter("buyRafflePaymentScene");
};

export const buyRafflePaymentScene = new Scenes.BaseScene(
  "buyRafflePaymentScene"
);

buyRafflePaymentScene.enter(async (ctx) => {
  await ctx.reply("How many tickets would you like to buy?");
});

buyRafflePaymentScene.on("text", async (ctx) => {
  const numberOfTickets = parseInt(ctx.message.text);
  if (isNaN(numberOfTickets) || numberOfTickets <= 0) {
    await ctx.reply("Please enter a valid number of tickets.");
    return;
  }
  ctx.session.numberOfTickets = numberOfTickets;
  if (ctx.session.wallets) {
    await ctx.scene.enter("handleWalletList");
  } else {
    await ctx.scene.enter("handleBuyRaffleWithoutWallet");
  }
});

const handleWalletList = new Scenes.BaseScene("handleWalletList");

handleWalletList.enter(async (ctx) => {
  const numberOfTickets = ctx.session.numberOfTickets;
  const userId = ctx.message.from.id;
  ctx.session.userId = userId;
  const sessionWallets = ctx.session.wallets || [];

  // Get raffle details from the store
  const raffleDetails = raffleDetailStore.get(userId);

  // Store the raffle details in the Map
  raffleDetail.set(userId, raffleDetails);

  if (!raffleDetails) {
    await ctx.reply("Raffle details not found.");
    return;
  }

  const ticketPriceBigNumber = raffleDetails["raffle"].entryCost;
  const ticketPrice = parseFloat(
    ethers.utils.formatEther(ticketPriceBigNumber)
  );
  const totalCost = ticketPrice * numberOfTickets;
  ctx.session.totalCost = totalCost;
  // Generate wallet buttons
  const walletButtons = sessionWallets.map((wallet) => [
    Markup.button.callback(
      wallet.address,
      `buy_raffle_wallet_${wallet.address}`
    ),
  ]);

  await ctx.reply(
    `The total cost is ${totalCost} ETH. Please confirm your payment method.`,
    Markup.inlineKeyboard(walletButtons)
  );
});

// Action handler to capture wallet selection
handleWalletList.action(/buy_raffle_wallet_(.+)/, async (ctx) => {
  const selectedWalletAddress = ctx.match[1]; // Extract the wallet address from the callback data

  // Save the selected wallet address in the session
  ctx.session.buyRaffleSelectedWalletAddress = selectedWalletAddress;

  // Reply with the selected wallet address
  await ctx.reply(`You have selected the wallet: ${selectedWalletAddress}`);
  await ctx.scene.enter("buyRaffleContractCallScene");
});

const handleBuyRaffleWithoutWallet = new Scenes.BaseScene(
  "handleBuyRaffleWithoutWallet"
);
handleBuyRaffleWithoutWallet.enter(async (ctx) => {
  ctx.session.BuyRaffle = true;
  await ctx.reply(
    "How would you like to proceed with the purchase?",
    Markup.inlineKeyboard([
      [Markup.button.callback("Create wallet", "generate-wallet-seed")],
      [Markup.button.callback("Import wallet", "import-existing-wallet")],
      [Markup.button.callback("Metamask application", "metamask_buy_ticket")],
    ])
  );
});

export const buyRaffleContractCallScene = new Scenes.BaseScene(
  "buyRaffleContractCallScene"
);

buyRaffleContractCallScene.enter(async (ctx) => {
  const raffleDetails = raffleDetail.get(ctx.session.userId);

  if (!raffleDetails) {
    await ctx.reply("Raffle details not found.");
    return;
  }

  const raffleId = raffleDetails.raffleId;
  const groupId = raffleDetails.groupId;
  let privateKey;
  if (ctx.session.mmstate === "buy_ticket") {
    privateKey = ctx.session.buyRaffleSelectedWalletAddress;
  } else {
    const walletAddress = ctx.session.buyRaffleSelectedWalletAddress;
    const wallet = getWalletByAddress(ctx, walletAddress);
    privateKey = decrypt(wallet.privateKey);
  }
  const numOfTickets = ctx.session.numberOfTickets;
  const totalCost = ctx.session.totalCost;
  const walletAddress = ctx.session.buyRaffleSelectedWalletAddress;
  const isSuccessful = await confirmBuyRaffle(
    ctx,
    privateKey,
    raffleId,
    numOfTickets,
    walletAddress,
    totalCost
  );

  if (isSuccessful) {
    await GlobalMetrics.updateOne(
      {},
      { $inc: { totalRafflesCreated: numOfTickets } },
      { upsert: true }
    );
    // Notify the group about the successful purchase
    let botIDAndToken;
    if (process.env.NODE_ENV === "development") {
      botIDAndToken = process.env.LOCAL_TELEGRAM_BOT_TOKEN;
    } else {
      botIDAndToken = process.env.TELEGRAM_BOT_TOKEN;
    }
    const message = `Ticket purchased by ${
      ctx.from.first_name || ctx.from.username
    } for Raffle ID: ${raffleId}, Number of Tickets: ${numOfTickets} , Cost of Tickets: ${totalCost}`;
    const telegramApiUrl = `https://api.telegram.org/bot${botIDAndToken}/sendMessage?chat_id=${parseInt(
      groupId
    )}&text=${encodeURIComponent(message)}`;
    await axios.get(telegramApiUrl);
    await ctx.reply(`Successfully notified the group about the purchase.`);
  }
});

//buy raffle method of smart contract
const confirmBuyRaffle = async (
  ctx,
  privateKey,
  raffleId,
  numTickets,
  walletAddress,
  totalCost
) => {
  await ctx.reply(
    `Initiating the purchase of ${numTickets} tickets for Raffle ID: ${raffleId}...`
  );

  try {
    const provider = new ethers.providers.JsonRpcProvider(
      CHAIN["sepolia"].rpcUrl
    );
    let wallet = new Wallet(privateKey, provider);
    ctx.session.currentWallet = wallet;

    // Create a contract instance
    const raffleContract = new Contract(RAFFLE_CONTRACT, RAFFLE_ABI, wallet);

    await ctx.reply("Your transaction is being processed, please wait...");

    if (ctx.session.mmstate === "buy_ticket") {
      await ctx.reply("Open MetaMask to sign the transaction...");
    }

    // Send the transaction
    const tx = await raffleContract.buyTickets(raffleId, numTickets, {
      value: ethers.utils.parseEther(totalCost.toString()),
      from: walletAddress,
      maxFeePerGas: ethers.utils.parseUnits("30", "gwei"),
      maxPriorityFeePerGas: ethers.utils.parseUnits("25", "gwei"),
      gasLimit: ethers.utils.hexlify(500000),
    });

    // Show transaction hash
    await ctx.reply(`Transaction sent: ${tx.hash}`);
    await ctx.reply("Your transaction is getting mined, please wait...");

    // Wait for transaction confirmation
    const receipt = await tx.wait();

    // Show transaction receipt information
    await ctx.reply(`Transaction mined: ${receipt.transactionHash}`);
    await ctx.reply(
      `Transaction successful! ${numTickets} tickets purchased for Raffle ID: ${raffleId}. 🎉`
    );

    ctx.session.mmstate = null; // Clear session state after transaction
    return true; // Return success status
  } catch (error) {
    if (error.code === ethers.errors.INSUFFICIENT_FUNDS) {
      await ctx.reply("Error: Insufficient funds to complete the transaction.");
    } else if (error.code === ethers.errors.NONCE_EXPIRED) {
      await ctx.reply(
        "Error: The transaction nonce has expired. Please try again."
      );
    } else if (error.code === ethers.errors.UNPREDICTABLE_GAS_LIMIT) {
      await ctx.reply(
        "Error: Unpredictable gas limit. Please ensure the contract is deployed correctly."
      );
    } else {
      await ctx.reply(`An error occurred: ${error.message}`);
    }
    console.error("Error during transaction:", error);
    return false; // Return failure status
  }
};

export const buyRafflePaymentScenes = [
  buyRaffleContractCallScene,
  buyRafflePaymentScene,
  handleBuyRaffleWithoutWallet,
  handleWalletList,
];
