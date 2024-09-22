import { Scenes } from "telegraf";
import { makeItClickable } from "../utils/bot-utils";
import { handleConfirmDetails } from "./add-raffle-actions";
import { handleSelectWallet } from "./referal-code";

export const chooseWalletNameScene = "chooseWalletNameScene";
export const chooseWalletNameStep = new Scenes.BaseScene(chooseWalletNameScene);

chooseWalletNameStep.enter(
  async (ctx) =>
    await ctx.reply(
      "Choose a name for the newly generated wallet. (Max 8 characters)"
    )
);

chooseWalletNameStep.on("text", async (ctx) => {
  const walletName = ctx.message.text;

  if (walletName.length > 8) {
    await ctx.reply("Wallet name must be less than or equal to 8 characters");
  } else {
    if (ctx.session.wallets && ctx.session.wallets.length === 6) {
      await ctx.reply("Wallet limit reached");
    } else {
      await ctx.deleteMessage(); // Ensure message deletion

      const newWallet = ctx.session.newWallet;
      newWallet.name = walletName;
      ctx.session.wallets = [...(ctx.session.wallets ?? []), newWallet];

      await ctx.replyWithHTML(
        `✅ New wallet <b>${walletName}</b> was successfully imported & encrypted\n\nAddress:\n${makeItClickable(
          newWallet.address
        )}`
      );

      // Redirect to confirm payment method if needed
      if (ctx.session.selectWalletReferal) {
        await ctx.scene.leave(); // Ensure the scene is left before proceeding
        await handleSelectWallet(ctx); // Handle the wallet referral
        ctx.session.selectWalletReferal = false;
      } else if (ctx.session.needsPaymentConfirmation) {
        await ctx.scene.leave(); // Ensure the scene is left before proceeding
        await ctx.scene.enter("confirmScene"); // Handle payment confirmation
        ctx.session.needsPaymentConfirmation = false;
      } else {
        await ctx.scene.leave();
      }
    }
  }

  // Clear the newWallet session after usage
  delete ctx.session.newWallet;
});
