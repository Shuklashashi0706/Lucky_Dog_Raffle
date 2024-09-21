import { Wallet, ethers, Contract } from "ethers";
import { CHAIN, RAFFLE_ABI, RAFFLE_CONTRACT } from "../config";


export const buyTickets = async (ctx) => {
  const wallets = ctx.session.wallets;
  if (wallets && wallets.length) {
    ctx.session.userState = userState;

    const walletButtons = wallets.map((wallet, index) => {
      const formattedAddress = `${wallet.address.slice(
        0,
        5
      )}...........${wallet.address.slice(-4)}`;
      return [
        {
          text: formattedAddress,
          callback_data: `wallet1_${wallet.address}`,
        },
      ];
    });

    walletButtons.push([
      {
        text: "Metamask application",
        callback_data: "metamask",
      },
    ]);

    await ctx.reply("Please confirm your payment method", {
      reply_markup: {
        inline_keyboard: walletButtons,
      },
    });
  } else {
    const createWallet = {
      text: "Create Wallet",
      callback_data: "generate-wallet-seed",
    };
    const importWallet = {
      text: "Import Wallet",
      callback_data: "import-existing-wallet",
    };

    const metamaskApp = {
      text: "Metamask Application",
      callback_data: "metamask",
    };

    await ctx.reply("How would you like to complete the transaction?", {
      reply_markup: {
        inline_keyboard: [[createWallet], [importWallet], [metamaskApp]],
      },
    });

    ctx.session.buyTicketsPayments = true;
   buyTickets(ctx)
  }
};

export const handlePaymentConfirmation = async() =>{
  const provider = new ethers.providers.JsonRpcProvider(
    CHAIN["sepolia"].rpcUrl
  );
  if (!privateKey) {
    ctx.reply(
      "Private key is not defined...just for testing purpose ...remove it"
    );
  }
  const wallet = new Wallet(privateKey, provider);
  const raffleId = 42;
      
  const contract = new Contract(RAFFLE_CONTRACT, RAFFLE_ABI, wallet);

  try {
    await ctx.reply("Your transaction is being processed, please wait...");
    const tx = await contract.buyTickets(
      raffleId,
      numberOfTickets
    );

    // Notify the user of the transaction hash
    await ctx.reply(`Transaction sent: ${tx.hash}`);
    await ctx.reply(`Your transaction is getting mined , please wait.....`);
    const receipt = await tx.wait();
    // Notify the user that the transaction has been mined
    await ctx.reply(`Transaction mined: ${receipt.transactionHash}`);
    await ctx.reply("Raffle is created successfully ✨");


  } catch (error) {
    console.error("Error Buying Tickets:", error);
    if (error.reason) {
      ctx.reply(`Failed to Buy Tickets: ${error.reason}`);
    } else {
      ctx.reply(
        "Failed to Buy Tickets. Please check input parameters and try again."
      );
    }
  }
}