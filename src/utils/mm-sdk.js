const { MetaMaskSDK } = require("@metamask/sdk");
const qrcode = require("qrcode");
const { ethers } = require("ethers");
import { Markup } from "telegraf";
import { createRaffle } from "./createRaffle";

const userSessions = new Map();
const delay = (ms) => new Promise((res) => setTimeout(res, ms));

const chainId = "0x13882";

const sdk = new MetaMaskSDK({
  shouldShimWeb3: false,
  chainId: 80002,
});

const ethereum = sdk.getProvider();

export const generateMMSigner = async (ctx) => {
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

          if (!checkForConnectedNetwork()) {
           
          }
        }
      } catch (error) {
        console.error("Error connecting:", error);
        await ctx.reply("Error connecting! Please try again.");
      }
    }

    ctx.session.currentWallet = from;

    if (from && userSessions.has(userId)) {
      const wallet = new ethers.providers.Web3Provider(ethereum).getSigner(
        from
      );
      return wallet;
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

export const handleMMTransactions = async (ctx) => {
  const wallet = await generateMMSigner(ctx);
  switch (ctx.session.mmstate) {
    case "add_raffle":
      await createRaffle(ctx, wallet);
      break;
    case "buy_ticket":
      ctx.session.mmstate = "buy_ticket";
      ctx.session.buyRaffleSelectedWalletAddress = wallet;
      ctx.scene.leave();
      ctx.scene.enter("handleWalletList");
      break;
    case "update_owner_check":
      ctx.session.updateRaffleSelectedAddress = await wallet.getAddress();
      if (
        ctx.session.adminWalletAddress.toLowerCase() !==
        ctx.session.updateRaffleSelectedAddress.toLowerCase()
      ) {
        ctx.reply(
          `Admin Wallet:${ctx.session.adminWalletAddress.toLowerCase()} and connected wallet:${ctx.session.updateRaffleSelectedAddress.toLowerCase()} do not match`,
          Markup.inlineKeyboard([
            Markup.button.callback("Try Again", `metamask_update_owner_check`),
          ])
        );
        ctx.session.updateRaffleSelectedAddress = null;
      } else {
        ctx.session.updateRaffleSelectedAddress = wallet;
        ctx.session.mmstate = "update_raffle";
        ctx.scene.enter("timeBasedRaffle");
      }
  }
};

async function checkForConnectedNetwork() {
  const currentChainId = await ethereum.request({ method: "eth_chainId" });
  if (currentChainId !== chainId) {
    return 0;
  } else return 1;
}
