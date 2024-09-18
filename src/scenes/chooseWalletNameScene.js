import { Scenes } from "telegraf";
import { makeItClickable } from "../utils/bot-utils";
import { handleConfirmDetails } from "./add-raffle-actions";
import { handleSelectWallet } from "./referal-code";
export const chooseWalletNameScene = "chooseWalletNameScene";
export const chooseWalletNameStep = new Scenes.BaseScene(chooseWalletNameScene);

chooseWalletNameStep.enter((ctx) =>
  ctx.reply("Choose a name for the newly generated wallet. (Max 8 characters)")
);

chooseWalletNameStep.on("text", (ctx) => {
  const walletName = ctx.message.text;

  if (walletName.length > 8) {
    ctx.reply("Wallet name must be less than or equal to 8 characters");
  } else {
    if (ctx.session.wallets && ctx.session.wallets.length === 6) {
      ctx.reply("Wallet limit reached");
    } else {
      ctx.deleteMessage();

      const newWallet = ctx.session.newWallet;
      newWallet.name = walletName;
      ctx.session.wallets = [...(ctx.session.wallets ?? []), newWallet];

      ctx.replyWithHTML(
        `✅ New wallet <b>${walletName}</b> was successfully imported & encrypted\n\nAddress:\n${makeItClickable(
          newWallet.address
        )}`
      );
      // Redirect to confirm payment method if needed
      // Redirect to confirm payment method if needed
      if (ctx.session.selectWalletReferal) {
        ctx.scene.leave();
        handleSelectWallet(ctx);
        ctx.session.selectWalletReferal = false;
      }

      if (ctx.session.needsPaymentConfirmation) {
        ctx.scene.leave();
        handleConfirmDetails(ctx, ctx.session.wallets);
        ctx.session.needsPaymentConfirmation = false;
      } else {
        ctx.scene.leave();
      }
    }
  }

  delete ctx.session.newWallet;
  ctx.scene.leave();
});
