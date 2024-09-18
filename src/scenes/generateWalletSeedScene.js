import { Scenes } from "telegraf";
import { generateAccount } from "../utils/account-utils";
import { makeItClickable } from "../utils/bot-utils";
import { decrypt } from "../utils/encryption-utils";
import { handleConfirmDetails } from "./add-raffle-actions";
import { handleSelectWallet } from "./referal-code";
export const generateWalletSeedScene = "generateWalletSeedScene";
export const generateWalletSeedStep = new Scenes.BaseScene(
  generateWalletSeedScene
);

generateWalletSeedStep.enter((ctx) =>
  ctx.reply(
    "🧐 Choose a name for the newly generated wallet. (Max 8 characters)"
  )
);

generateWalletSeedStep.on("text", (ctx) => {
  const walletName = ctx.message.text;

  if (walletName.length > 8) {
    ctx.reply("Wallet name must be less than or equal to 8 characters");
  } else {
    if (ctx.session.wallets && ctx.session.wallets.length === 6) {
      ctx.reply("Wallet limit reached");
    } else {
      ctx.deleteMessage();

      const newWallet = generateAccount();
      newWallet.name = walletName;
      ctx.session.wallets = [...(ctx.session.wallets ?? []), newWallet];

      ctx.replyWithHTML(
        `✅ New wallet <b>${walletName}</b> was successfully created & encrypted.\n\nAddress:\n${makeItClickable(
          newWallet.address
        )}\nPrivate Key:\n${makeItClickable(
          decrypt(newWallet.privateKey)
        )}\nMnemonic Phrase:\n${makeItClickable(
          decrypt(newWallet.mnemonic)
        )}\n\nMake sure to save the information above offline. Never send it to anyone, and never hold it in a plain text format on a device connected to the internet. You can also import the wallet above in your Web3 wallet provider (Metamask, Trust Wallet, etc).\n\nOnce you're finished writing down your secret phrase, delete this message. DracoFlip will never display this information again.\n\nSubmit the /wallets command to check the wallet.`
      );

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
});
