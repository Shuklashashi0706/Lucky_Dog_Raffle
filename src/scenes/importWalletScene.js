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

importWalletStep.on("text", (ctx) => {
  const phrase = ctx.message.text;
  ctx.deleteMessage();

  try {
    const wallet = generateAccount(phrase);
    ctx.session.newWallet = wallet;
    ctx.scene.enter(chooseWalletNameScene);
  } catch (error) {
    console.error("Error generating wallet:", error);
    ctx.reply(
      "😔 This does not appear to be a valid private key / mnemonic phrase. Please try again."
    );
    ctx.scene.reenter(); // Re-enter the scene to allow user to try again
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
