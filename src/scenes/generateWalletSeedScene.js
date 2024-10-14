import { Scenes } from "telegraf";
import { generateAccount } from "../utils/account-utils";
import { makeItClickable } from "../utils/bot-utils";
import { decrypt } from "../utils/encryption-utils";
import { handleConfirmDetails } from "./add-raffle-actions";
import { handleSelectWallet } from "./referal-code";
import { handleBuyRaffle } from "../utils/buyRaffle";
export const generateWalletSeedScene = "generateWalletSeedScene";
export const generateWalletSeedStep = new Scenes.BaseScene(
  generateWalletSeedScene
);

generateWalletSeedStep.enter((ctx) =>
  ctx.reply(
    "🧐 Choose a name for the newly generated wallet. (Max 16 characters)"
  )
);

generateWalletSeedStep.on("text", async (ctx) => {
  const walletName = ctx.message.text;
  if (walletName.length > 16) {
    await ctx.reply(`Wallet name must be less than or equal to 16 characters`);
  } else {
    if (ctx.session.wallets && ctx.session.wallets.length === 6) {
      await ctx.reply("Wallet limit reached");
    } else {
      await ctx.deleteMessage();

      const newWallet = generateAccount();
      newWallet.name = walletName;
      ctx.session.wallets = [...(ctx.session.wallets ?? []), newWallet];

      await ctx.replyWithHTML(
        `✅ New wallet <b>${walletName}</b> was successfully created & encrypted.\n\nAddress:\n${makeItClickable(
          newWallet.address
        )}\nPrivate Key:\n${makeItClickable(
          decrypt(newWallet.privateKey)
        )}\nMnemonic Phrase:\n${makeItClickable(
          decrypt(newWallet.mnemonic)
        )}\n\nMake sure to save the information above offline. Never send it to anyone, and never hold it in a plain text format on a device connected to the internet. You can also import the wallet above in your Web3 wallet provider (Metamask, Trust Wallet, etc).\n\nOnce you're finished writing down your secret phrase, delete this message. DracoFlip will never display this information again.\n\nSubmit the /wallets command to check the wallet.`
      );

      if (ctx.session.selectWalletReferal) {
        await ctx.scene.leave();
        await handleSelectWallet(ctx);
        ctx.session.selectWalletReferal = false;
      } else if (ctx.session.needsPaymentConfirmation) {
        await ctx.scene.leave();
        ctx.scene.enter("confirmScene");
        ctx.session.needsPaymentConfirmation = false;
      } else if (ctx.session.BuyRaffle) {
        await ctx.scene.leave();
        await ctx.scene.enter("handleWalletList");
        delete ctx.session.BuyRaffle;
      } else {
        await ctx.scene.leave();
      }
    }
  }
});
