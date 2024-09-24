const { MetaMaskSDK } = require("@metamask/sdk");
const qrcode = require("qrcode");
const { ethers, Contract } = require("ethers");
import { RAFFLE_ABI, RAFFLE_CONTRACT } from "../config";
 
const userSessions = new Map();
const ZERO_WALLET_ADDRESS = "0x0000000000000000000000000000000000000000";
const delay = (ms) => new Promise((res) => setTimeout(res, ms));

const sdk = new MetaMaskSDK({
  shouldShimWeb3: false,
  chainId: 11155111,
});

const ethereum = sdk.getProvider();

export const createRaffleViaMetaMask = async (ctx) => {
  const userId = ctx.from.id;

  if (userSessions.has(userId)) {
    await ctx.reply(
      "A session is already in progress. Please finish or cancel it before starting a new one."
    );
    return;
  }

  userSessions.set(userId, { sdk, ethereum, ctx });

  try {
    const accountsPromise = ethereum.request({
      method: "eth_requestAccounts",
      params: [],
    });

    await delay(2500);

    const link = sdk.getUniversalLink();
    const qrBuffer = await qrcode.toBuffer(link, {
      type: "png",
    });

    await ctx.replyWithPhoto({ source: qrBuffer });
    await ctx.reply(`Please scan the QR code or use this URL:\n${link}`);
    await ctx.reply("Waiting for Wallet Connection...");

    let connected = false;
    let from;

    while (!connected && userSessions.has(userId)) {
      await delay(5000);
      try {
        const accounts = await accountsPromise;
        from = accounts[0];
        if (from !== undefined) {
          connected = true;
          await ctx.reply(`Wallet connected: ${from}`);
        }
      } catch (error) {
        console.error("Error connecting:", error);
        await ctx.reply("Error connecting! Please try again.");
      }
    }

    if (from && userSessions.has(userId)) {
      await ctx.reply("Initiating raffle creation...");
      const wallet = new ethers.providers.Web3Provider(ethereum).getSigner(
        from
      );

      // return wallet;
      const contract = new Contract(RAFFLE_CONTRACT, RAFFLE_ABI, wallet);
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
      try {
        await ctx.reply("Open MetaMask to sign the transaction...");
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
        await ctx.reply("Your transaction is getting mined, please wait...");
        const receipt = await tx.wait();
        await ctx.reply(`Transaction mined: ${receipt.transactionHash}`);
        await ctx.reply("Raffle created successfully 🎉");

        return true;
      } catch (error) {
        console.error("Error creating raffle:", error);
        await ctx.reply("Failed to create raffle. Please try again.");
      }
    } else if (userSessions.has(userId)) {
      await ctx.reply("No account connected. Cannot create raffle.");
    }
  } catch (error) {
    console.error("An error occurred:", error);
    await ctx.reply("An error occurred. Please try again later.");
  } finally {
    userSessions.delete(userId);
  }
};

export const cancelSession = async (ctx) => {
  const userId = ctx.from.id;
  if (userSessions.has(userId)) {
    userSessions.delete(userId);
    await ctx.reply("Your session has been cancelled.");
  } else {
    await ctx.reply("You don't have an active session.");
  }
};
