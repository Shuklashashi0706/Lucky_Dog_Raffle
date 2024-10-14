import { Scenes } from "telegraf";
import { makeItClickable } from "../utils/bot-utils";
import { handleSelectWallet } from "./referal-code";
import { handleBuyRaffle } from "../utils/buyRaffle";

export const chooseWalletNameScene = "chooseWalletNameScene";
export const chooseWalletNameStep = new Scenes.BaseScene(chooseWalletNameScene);

chooseWalletNameStep.enter(
  async (ctx) =>
    await ctx.reply(
      "Choose a name for the newly generated wallet. (Max 16 characters)"
    )
);

chooseWalletNameStep.on("text", async (ctx) => {
  const walletName = ctx.message.text;

  if (walletName.length > 16) {
    await ctx.reply("Wallet name must be less than or equal to 16 characters");
  } else {
    if (ctx.session.wallets && ctx.session.wallets.length === 6) {
      await ctx.reply("Wallet limit reached");
    } else {
      await ctx.deleteMessage(); // Ensure message deletion

      // Assign the name to the new wallet
      const newWallet = ctx.session.newWallet;
      
      newWallet.name = walletName;
      ctx.session.wallets = [...(ctx.session.wallets ?? []), newWallet];

      await ctx.replyWithHTML(
        `✅ New wallet <b>${walletName}</b> was successfully imported & encrypted\n\nAddress:\n${makeItClickable(
          newWallet.address
        )}`
      );

      // Handle different scenarios for post-wallet import actions
      if (ctx.session.selectWalletReferal) {
        await ctx.scene.leave();
        await handleSelectWallet(ctx);
        ctx.session.selectWalletReferal = false;
      } else if (ctx.session.needsPaymentConfirmation) {
        await ctx.scene.leave();
        await ctx.scene.enter("confirmScene");
        ctx.session.needsPaymentConfirmation = false;
      } else if (ctx.session.BuyRaffle) {
        await ctx.scene.leave();
        await ctx.scene.enter("handleWalletList");
        delete ctx.session.BuyRaffle;
      } else if (ctx.session.redirectToUpdateRaffle === true) {
        ctx.session.redirectToUpdateRaffle = false;
        await ctx.scene.leave();
        ctx.scene.enter("timeBasedRaffle");
      } else {
        await ctx.scene.leave();
      }
    }
    delete ctx.session.newWallet;
  }

});
