"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const express_1 = __importDefault(require("express"));
const telegraf_1 = require("telegraf");
const bot_utils_1 = require("./utils/bot-utils");
const connect_db_1 = __importDefault(require("./utils/connect-db"));
const group_1 = __importDefault(require("./models/group"));
const raffle_1 = __importDefault(require("./models/raffle"));
const add_raffle_actions_1 = require("./scenes/add-raffle-actions");
const referal_code_1 = require("./scenes/referal-code");
const importWalletScene_1 = require("./scenes/importWalletScene");
const generateWalletSeedScene_1 = require("./scenes/generateWalletSeedScene");
const importWalletScene_2 = require("./scenes/importWalletScene");
const chooseWalletNameScene_1 = require("./scenes/chooseWalletNameScene");
const generateWalletSeedScene_2 = require("./scenes/generateWalletSeedScene");
const bot_utils_2 = require("./utils/bot-utils");
const bot_utils_3 = require("./utils/bot-utils");
const state_1 = require("./utils/state");
const message_utils_1 = require("./utils/message-utils");
const handle_lucky_command_1 = require("./scenes/handle-lucky-command");
const createRaffle_1 = require("./utils/createRaffle");
const add_raffle_actions_2 = require("./scenes/add-raffle-actions");
const handle_lucky_command_2 = require("./scenes/handle-lucky-command");
const buyTickets_1 = require("./utils/buyTickets");
dotenv_1.default.config();
if (!process.env.TELEGRAM_BOT_TOKEN) {
    console.error("Setup your token");
    process.exit(1);
}
let bot;
if (process.env.NODE_ENV === "development") {
    bot = new telegraf_1.Telegraf("7518728844:AAEoJq_x2GZyn20GstLgbfskoCsWLLf3TGU");
}
else {
    bot = new telegraf_1.Telegraf(process.env.TELEGRAM_BOT_TOKEN);
}
const stage = new telegraf_1.Scenes.Stage([
    importWalletScene_2.importWalletStep,
    chooseWalletNameScene_1.chooseWalletNameStep,
    generateWalletSeedScene_2.generateWalletSeedStep,
    handle_lucky_command_2.luckyScene,
    ...add_raffle_actions_1.addRaffleScenes,
]);
bot.use((0, telegraf_1.session)());
bot.use(stage.middleware());
// Function to check if a user has blocked the bot
function checkBlockedUser(ctx, userId) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            yield ctx.telegram.sendChatAction(userId, "typing");
            return false; // User has not blocked the bot
        }
        catch (error) {
            if (error.response && error.response.error_code === 403) {
                console.log(`User ${userId} has blocked the bot.`);
                return true; // User has blocked the bot
            }
            else {
                console.error("An unexpected error occurred:", error);
                return true; // Treat other errors conservatively
            }
        }
    });
}
// Handle the start command
bot.start((ctx) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    if ((_a = ctx.chat) === null || _a === void 0 ? void 0 : _a.type.includes("group")) {
        return;
    }
    // Check if the user has blocked the bot
    const isBlocked = yield checkBlockedUser(ctx, ctx.from.id);
    if (isBlocked) {
        // Stop further processing if the user has blocked the bot
        return;
    }
    try {
        // Create inline keyboard buttons
        const keyboard = telegraf_1.Markup.inlineKeyboard([
            [
                telegraf_1.Markup.button.url("Add bot to group", `https://t.me/${ctx.botInfo.username}?startgroup=true`),
            ],
            [
                telegraf_1.Markup.button.callback("Create/Update a raffle", "CREATE_UPDATE_RAFFLE"),
            ],
        ]);
        yield ctx.reply("Welcome to Lucky Dog Raffle Bot! Telegram's Original Buy Bot! What would you like to do today?", keyboard);
    }
    catch (error) {
        console.error("Error while sending message:", error);
    }
}));
// Handle the "Create/Update a raffle" button action
bot.action("CREATE_UPDATE_RAFFLE", (ctx) => __awaiter(void 0, void 0, void 0, function* () {
    yield ctx.deleteMessage();
    yield ctx.reply("Create Raffle option selected");
    yield (0, add_raffle_actions_1.handleAddRaffle)(ctx);
}));
// General middleware to handle all types of actions
bot.use((ctx, next) => __awaiter(void 0, void 0, void 0, function* () {
    const isBlocked = yield checkBlockedUser(ctx, ctx.from.id);
    if (isBlocked) {
        return;
    }
    yield next();
}));
// -----------------------  wallet setup start -----------------------------
// back buttons
bot.action("back-to-main-menu", (ctx) => __awaiter(void 0, void 0, void 0, function* () {
    if (state_1.prevMessageState.prevMessage) {
        yield ctx.deleteMessage(state_1.prevMessageState.prevMessage.message_id);
    }
    delete ctx.session.selectedDeleteWalletName;
    delete ctx.session.selectedPlayWalletName;
    delete ctx.session.selectedRefundWalletName;
    yield (0, bot_utils_1.menuCommand)(ctx, ctx.session.wallets);
}));
// bot.command("menu", async (ctx) => {
//   await menuCommand(ctx, ctx.session.wallets);
// });
bot.command("wallets", (ctx) => __awaiter(void 0, void 0, void 0, function* () {
    yield (0, bot_utils_1.walletsCommand)(ctx, ctx.session.wallets);
}));
bot.action("wallets", (ctx) => __awaiter(void 0, void 0, void 0, function* () {
    if (state_1.prevMessageState.prevMessage) {
        yield ctx.deleteMessage(state_1.prevMessageState.prevMessage.message_id);
    }
    yield (0, bot_utils_1.walletsCommand)(ctx, ctx.session.wallets);
}));
bot.command("lucky", (ctx) => __awaiter(void 0, void 0, void 0, function* () {
    ctx.scene.enter("LUCKY_SCENE");
}));
bot.action("metamask", (ctx) => __awaiter(void 0, void 0, void 0, function* () {
    if (state_1.prevMessageState.prevMessage) {
        yield ctx.deleteMessage(state_1.prevMessageState.prevMessage.message_id);
    }
    yield (0, add_raffle_actions_2.handleMetamaskApplication)(ctx);
}));
// create wallet buttons
bot.action("import-existing-wallet", (ctx) => __awaiter(void 0, void 0, void 0, function* () {
    yield ctx.deleteMessage();
    ctx.scene.enter(importWalletScene_1.importWalletScene);
}));
bot.action("generate-wallet-seed", (ctx) => __awaiter(void 0, void 0, void 0, function* () {
    yield ctx.deleteMessage();
    ctx.scene.enter(generateWalletSeedScene_1.generateWalletSeedScene);
}));
bot.action("btn-delete-wallet", (ctx) => __awaiter(void 0, void 0, void 0, function* () {
    if (state_1.prevMessageState.prevMessage) {
        yield ctx.deleteMessage(state_1.prevMessageState.prevMessage.message_id);
    }
    yield (0, bot_utils_2.btnDeleteWalletAction)(ctx, ctx.session.wallets);
}));
bot.action(/^delete-wallet-/, (ctx) => __awaiter(void 0, void 0, void 0, function* () {
    if (state_1.prevMessageState.prevMessage) {
        yield ctx.deleteMessage(state_1.prevMessageState.prevMessage.message_id);
    }
    const walletName = ctx.update.callback_query.data.split("-")[2];
    ctx.session.selectedDeleteWalletName = walletName;
    const wallet = (0, bot_utils_3.getWalletByName)(ctx, walletName);
    yield (0, bot_utils_3.dynamicDeleteWalletAction)(ctx, wallet);
}));
bot.action("confirm-delete-wallet", (ctx) => __awaiter(void 0, void 0, void 0, function* () {
    if (state_1.prevMessageState.prevMessage) {
        yield ctx.deleteMessage(state_1.prevMessageState.prevMessage.message_id);
    }
    ctx.session.wallets = ctx.session.wallets.filter((_wallet) => _wallet.name !== ctx.session.selectedDeleteWalletName);
    delete ctx.session.selectedDeleteWalletName;
    if (ctx.session.wallets.length) {
        yield (0, bot_utils_2.btnDeleteWalletAction)(ctx, ctx.session.wallets);
    }
    else {
        yield (0, bot_utils_1.walletsCommand)(ctx, ctx.session.wallets);
    }
}));
// -----------------------  wallet setup end -----------------------------
// ----------------- referal code start -----------
bot.command("referral_code", (ctx) => __awaiter(void 0, void 0, void 0, function* () {
    yield (0, referal_code_1.handleReferralCode)(ctx);
}));
bot.action("create_new_referral", (ctx) => __awaiter(void 0, void 0, void 0, function* () {
    if (state_1.prevMessageState.prevMessage) {
        yield ctx.deleteMessage(state_1.prevMessageState.prevMessage.message_id);
    }
    yield (0, referal_code_1.handleCreateNewReferal)(ctx);
}));
bot.action("input_wallet_address", (ctx) => __awaiter(void 0, void 0, void 0, function* () {
    if (state_1.prevMessageState.prevMessage) {
        yield ctx.deleteMessage(state_1.prevMessageState.prevMessage.message_id);
    }
    yield (0, referal_code_1.handleInputWalletPrompt)(ctx);
}));
bot.action("select_wallet_address", (ctx) => __awaiter(void 0, void 0, void 0, function* () {
    if (state_1.prevMessageState.prevMessage) {
        yield ctx.deleteMessage(state_1.prevMessageState.prevMessage.message_id);
    }
    yield (0, referal_code_1.handleSelectWallet)(ctx);
}));
// Bot action to handle wallet selection from the inline keyboard
bot.action(/^select_wallet_/, (ctx) => __awaiter(void 0, void 0, void 0, function* () {
    const walletAddress = ctx.match.input.split("select_wallet_")[1]; // Extract wallet address from callback data
    if (!walletAddress) {
        ctx.reply("Failed to identify the selected wallet. Please try again.");
        return;
    }
    yield (0, referal_code_1.handleWalletSelection)(ctx, walletAddress);
}));
// Handle "Enter again" option
bot.action("enter_referral_again", (ctx) => __awaiter(void 0, void 0, void 0, function* () {
    yield (0, add_raffle_actions_1.handleCreateRaffleWithReferral)(ctx);
}));
// Handle "Proceed without referral" option
bot.action("proceed_without_referral", (ctx) => __awaiter(void 0, void 0, void 0, function* () {
    const walletAddress = ctx.session.walletAddress;
    yield (0, add_raffle_actions_1.handleCreateRaffleWithoutReferral)(ctx, walletAddress);
}));
// ----------------- referal code end -----------
// -------------- create raffle start ------------
// Handle the action when a wallet address is selected
bot.action(/^wallet_(.*)/, (ctx) => __awaiter(void 0, void 0, void 0, function* () {
    yield ctx.deleteMessage();
    const walletAddress = ctx.match[1];
    state_1.prevMessageState.prevMessage = yield ctx.reply(`Do you have any referral code?\nCreate with referral code, 2% service fee for bot and 0.5% referral fee for referrer.\nCreate without referral code, 3% service fee for bot.`, {
        reply_markup: {
            inline_keyboard: [
                [
                    {
                        text: "Yes, I have a referral code",
                        callback_data: `has_referral_${walletAddress}`,
                    },
                ],
                [
                    {
                        text: "No, continue without referral",
                        callback_data: `no_referral_${walletAddress}`,
                    },
                ],
            ],
        },
    });
}));
bot.action(/^wallet1_(.*)/, (ctx) => __awaiter(void 0, void 0, void 0, function* () {
    (0, buyTickets_1.handlePaymentConfirmation)();
}));
bot.action(/buy_ticket_(\d+)_(\w+)/, (ctx) => __awaiter(void 0, void 0, void 0, function* () {
    (0, handle_lucky_command_1.handleBuyTicketAction)(ctx);
}));
// Handle "Yes, I have a referral code"
bot.action(/^has_referral_(.*)/, (ctx) => __awaiter(void 0, void 0, void 0, function* () {
    if (state_1.prevMessageState.prevMessage) {
        yield ctx.deleteMessage(state_1.prevMessageState.prevMessage.message_id);
    }
    const walletAddress = ctx.match[1]; // Extract wallet address from callback data
    yield (0, add_raffle_actions_1.handleCreateRaffleWithReferral)(ctx, walletAddress);
}));
// Handle "No, continue without referral"
bot.action(/^no_referral_(.*)/, (ctx) => __awaiter(void 0, void 0, void 0, function* () {
    if (state_1.prevMessageState.prevMessage) {
        yield ctx.deleteMessage(state_1.prevMessageState.prevMessage.message_id);
    }
    const walletAddress = ctx.match[1]; // Extract wallet address from callback data
    yield (0, add_raffle_actions_1.handleCreateRaffleWithoutReferral)(ctx, walletAddress);
}));
// -------------- create raffle end ------------
// -----------------------adding bot to group-------------------
bot.on("new_chat_members", (ctx) => __awaiter(void 0, void 0, void 0, function* () {
    if (ctx.message.new_chat_members.some((member) => member.id === ctx.botInfo.id)) {
        // Extracting group and bot details from the context
        const groupId = ctx.chat.id.toString();
        const groupUsername = ctx.chat.title;
        const botId = ctx.botInfo.id.toString();
        const botUsername = ctx.botInfo.username;
        const username = ctx.message.from.username || "Unknown"; // Fallback if username is not available
        const userId = ctx.message.from.id;
        try {
            // Check if the group already exists
            const existingGroup = yield group_1.default.findOne({ groupId, botId });
            if (existingGroup) {
                ctx.reply(`Lucky Dog Raffle Bot is already present in this group! Please click [here](https://t.me/${ctx.botInfo.username}) to continue the setup in the private chat.`, { parse_mode: "Markdown" });
                return;
            }
            // Create a new Group document
            const newGroup = new group_1.default({
                groupId,
                groupUsername,
                botId,
                botUsername,
                username,
                userId,
                raffleId: null, // Set to null initially or link to an existing raffle if available
            });
            // Save the new group details to the database
            yield newGroup.save();
            console.log(`Bot added group: ${groupId}. Group document added successfully`);
            ctx.reply(`Lucky Dog Raffle Bot has been added to the group! Please click [here](https://t.me/${ctx.botInfo.username}) to continue the setup in the private chat.`, { parse_mode: "Markdown" });
        }
        catch (error) {
            console.error("Error saving group details:", error);
            // Handle different types of errors
            if (error instanceof mongoose.Error.ValidationError) {
                ctx.reply("Validation error occurred. Please ensure all required information is correct.");
            }
            else if (error.code === 11000) {
                // Duplicate key error
                ctx.reply("It seems the bot is already added to this group.");
            }
            else {
                ctx.reply("An unexpected error occurred while saving the group details. Please try again or contact support.");
            }
        }
    }
}));
bot.on("left_chat_member", (ctx) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    // Check if the member who left is the bot itself
    if (((_b = (_a = ctx.message) === null || _a === void 0 ? void 0 : _a.left_chat_member) === null || _b === void 0 ? void 0 : _b.id) === ctx.botInfo.id) {
        // Extract group and bot details from the context
        const groupId = ctx.chat.id.toString();
        const botId = ctx.botInfo.id.toString();
        const botUsername = ctx.botInfo.username;
        try {
            // Attempt to find and delete the corresponding group document
            const groupResult = yield group_1.default.findOneAndDelete({
                groupId,
                botId,
                botUsername,
            });
            if (groupResult) {
                console.log(`Bot removed from group: ${groupId}. Group document deleted successfully.`);
                // Attempt to delete all raffles associated with the group ID
                const raffleResult = yield raffle_1.default.deleteMany({ createdGroup: groupId });
                if (raffleResult.deletedCount > 0) {
                    console.log(`Deleted ${raffleResult.deletedCount} raffle(s) associated with group: ${groupId}.`);
                }
                else {
                    console.log(`No raffles found associated with group: ${groupId}. No raffles were deleted.`);
                }
            }
            else {
                console.log(`No matching group document found for group: ${groupId}.`);
            }
        }
        catch (error) {
            console.error("Error removing group document or associated raffles:", error);
        }
    }
}));
bot.action(/^SELECT_GROUP_/, add_raffle_actions_1.handleGroupSelection);
bot.action(/^ADD_RAFFLE_(.*)/, (ctx) => __awaiter(void 0, void 0, void 0, function* () {
    yield ctx.deleteMessage();
    yield ctx.reply("Add Raffle option selected");
    const groupId = ctx.match[1];
    ctx.session.groupId = groupId;
    ctx.scene.enter("raffleScene");
}));
bot.action(/^UPDATE_RAFFLE_(.*)/, (ctx) => __awaiter(void 0, void 0, void 0, function* () {
    if (state_1.prevMessageState.prevMessage) {
        yield ctx.deleteMessage(state_1.prevMessageState.prevMessage.message_id);
    }
    yield ctx.reply("Update Raffle option selected");
    const groupId = ctx.match[1];
    // Handle the logic for updating a running raffle
    yield ctx.reply(`Updating a running raffle for group ID: ${groupId}`);
}));
bot.action(/^VIEW_RAFFLE_(.*)/, (ctx) => __awaiter(void 0, void 0, void 0, function* () {
    if (state_1.prevMessageState.prevMessage) {
        yield ctx.deleteMessage(state_1.prevMessageState.prevMessage.message_id);
    }
    const groupId = ctx.match[1];
    // Handle the logic for viewing raffle details
    yield ctx.reply(`Viewing raffle details for group ID: ${groupId}`);
}));
// Connect to the database
(0, connect_db_1.default)();
if (process.env.NODE_ENV === "development") {
    bot.launch(() => {
        console.log("Bot is running in dev mode");
    });
}
else if (process.env.NODE_ENV === "production") {
    const app = (0, express_1.default)();
    app.use(express_1.default.json());
    app.use(bot.webhookCallback("/secret-path"));
    bot.telegram.setWebhook(`${process.env.SERVER_URL}/secret-path`);
    app.get("/", (req, res) => {
        res.send("Server is running");
    });
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
}
// Enable graceful stop
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
//# sourceMappingURL=index.js.map