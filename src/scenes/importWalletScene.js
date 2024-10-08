import { Scenes } from "telegraf";
import { generateAccount } from "../utils/account-utils";
import { chooseWalletNameScene } from "./chooseWalletNameScene";

export const importWalletScene = "importWalletScene";
export const importWalletStep = new Scenes.BaseScene(importWalletScene);

importWalletStep.enter((ctx) =>
  ctx.reply(
    "Please provide either the private key of the wallet you wish to import or a 12-word mnemonic phrase."
  )
);

importWalletStep.on("text", async (ctx) => {
  const phrase = ctx.message.text;
  ctx.deleteMessage();

  try {
    const newWallet = generateAccount(phrase);
    // Check if the wallet address already exists in the session wallets
    const isDuplicate = (ctx.session.wallets || []).some(
      (wallet) => wallet.address === newWallet.address
    );
    if (isDuplicate) {
      await ctx.reply("🚫 This wallet address already exists in your list.");
      await ctx.scene.leave();
      return;
    } else {
      ctx.session.newWallet = newWallet;
      ctx.scene.enter(chooseWalletNameScene);
    }
  } catch (error) {
    console.error("Error generating wallet:", error);
    ctx.reply(
      "😔 This does not appear to be a valid private key / mnemonic phrase. Please try again."
    );
    ctx.scene.reenter();
  }
});

// Handling wallet naming after import
importWalletStep.on("leave", (ctx) => {
  // Check if new wallet added and payment confirmation is needed
  if (ctx.session.newWallet) {
    ctx.session.wallets = [
      ...(ctx.session.wallets ?? []),
      ctx.session.newWallet,
    ];
    ctx.session.newWallet = null;
  }
});
