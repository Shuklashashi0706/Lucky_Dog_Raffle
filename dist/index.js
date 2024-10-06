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
const cors_1 = __importDefault(require("cors"));
const express_1 = __importDefault(require("express"));
const telegraf_1 = require("telegraf");
const bot_utils_1 = require("./utils/bot-utils");
const connect_db_1 = __importDefault(require("./utils/connect-db"));
const group_1 = __importDefault(require("./models/group"));
const raffle_1 = __importDefault(require("./models/raffle"));
const add_raffle_actions_1 = require("./scenes/add-raffle-actions");
const buy_raffle_scene_1 = require("./scenes/buy-raffle-scene");
const buyRaffle_1 = require("./utils/buyRaffle");
const buy_raffle_scene_2 = require("./scenes/buy-raffle-scene");
const referal_code_1 = require("./scenes/referal-code");
const importWalletScene_1 = require("./scenes/importWalletScene");
const generateWalletSeedScene_1 = require("./scenes/generateWalletSeedScene");
const importWalletScene_2 = require("./scenes/importWalletScene");
const chooseWalletNameScene_1 = require("./scenes/chooseWalletNameScene");
const generateWalletSeedScene_2 = require("./scenes/generateWalletSeedScene");
const bot_utils_2 = require("./utils/bot-utils");
const bot_utils_3 = require("./utils/bot-utils");
const state_1 = require("./utils/state");
const update_raffle_1 = require("./scenes/update-raffle");
const buyRaffle_2 = require("./utils/buyRaffle");
const my_raffle_scene_1 = require("./scenes/my-raffle-scene");
const mm_sdk_1 = require("./utils/mm-sdk");
const global_metrics_1 = require("./controllers/global-metrics");
const active_raffles_1 = require("./controllers/active-raffles");
const completed_raffles_1 = require("./controllers/completed_raffles");
const revenuedistribution_1 = require("./controllers/revenuedistribution");
const raffle_pool_1 = require("./controllers/raffle-pool");
dotenv_1.default.config();
if (!process.env.TELEGRAM_BOT_TOKEN) {
    console.error("Setup your token");
    process.exit(1);
}
let bot;
if (process.env.NODE_ENV === "development") {
    bot = new telegraf_1.Telegraf(process.env.LOCAL_TELEGRAM_BOT_TOKEN);
}
else {
    bot = new telegraf_1.Telegraf(process.env.TELEGRAM_BOT_TOKEN);
}
const stage = new telegraf_1.Scenes.Stage([
    importWalletScene_2.importWalletStep,
    chooseWalletNameScene_1.chooseWalletNameStep,
    generateWalletSeedScene_2.generateWalletSeedStep,
    ...add_raffle_actions_1.addRaffleScenes,
    ...update_raffle_1.updateRaffleScenes,
    ...buy_raffle_scene_1.buyRaffleScenes,
    ...buyRaffle_1.buyRafflePaymentScenes,
    my_raffle_scene_1.myRaffle,
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
        return;
    }
    try {
        // Create inline keyboard buttons
        const keyboard = telegraf_1.Markup.inlineKeyboard([
            [
                telegraf_1.Markup.button.url("Add bot to group", `https://t.me/${ctx.botInfo.username}?startgroup=true&admin=change_info+delete_messages+restrict_members+invite_users+pin_messages+manage_topics+manage_video_chats+promote_members`),
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
bot.command("wallets", (ctx) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    if ((_a = ctx.chat) === null || _a === void 0 ? void 0 : _a.type.includes("group")) {
        return;
    }
    yield (0, bot_utils_1.walletsCommand)(ctx, ctx.session.wallets);
}));
bot.action("wallets", (ctx) => __awaiter(void 0, void 0, void 0, function* () {
    if (state_1.prevMessageState.prevMessage) {
        yield ctx.deleteMessage(state_1.prevMessageState.prevMessage.message_id);
    }
    yield (0, bot_utils_1.walletsCommand)(ctx, ctx.session.wallets);
}));
bot.action(/^metamask_(.*)/, (ctx) => __awaiter(void 0, void 0, void 0, function* () {
    yield ctx.deleteMessage();
    ctx.session.mmstate = ctx.match[1];
    yield (0, mm_sdk_1.handleMMTransactions)(ctx);
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
    var _a;
    if ((_a = ctx.chat) === null || _a === void 0 ? void 0 : _a.type.includes("group")) {
        return;
    }
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
bot.action(/^select_wallet_/, (ctx) => __awaiter(void 0, void 0, void 0, function* () {
    const walletAddress = ctx.match.input.split("select_wallet_")[1]; // Extract wallet address from callback data
    if (!walletAddress) {
        ctx.reply("Failed to identify the selected wallet. Please try again.");
        return;
    }
    yield (0, referal_code_1.handleWalletSelection)(ctx, walletAddress);
}));
bot.action("enter_referral_again", (ctx) => __awaiter(void 0, void 0, void 0, function* () {
    yield (0, add_raffle_actions_1.handleCreateRaffleWithReferral)(ctx);
}));
bot.action("proceed_without_referral", (ctx) => __awaiter(void 0, void 0, void 0, function* () {
    const walletAddress = ctx.session.walletAddress;
    yield (0, add_raffle_actions_1.handleCreateRaffleWithoutReferral)(ctx, walletAddress);
}));
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
bot.action(/^has_referral_(.*)/, (ctx) => __awaiter(void 0, void 0, void 0, function* () {
    if (state_1.prevMessageState.prevMessage) {
        yield ctx.deleteMessage(state_1.prevMessageState.prevMessage.message_id);
    }
    const walletAddress = ctx.match[1];
    ctx.session.referralSelectedWalletAddress = walletAddress;
    yield ctx.scene.enter("handleCreateRaffleWithReferral");
}));
bot.action(/^no_referral_(.*)/, (ctx) => __awaiter(void 0, void 0, void 0, function* () {
    if (state_1.prevMessageState.prevMessage) {
        yield ctx.deleteMessage(state_1.prevMessageState.prevMessage.message_id);
    }
    const walletAddress = ctx.match[1]; // Extract wallet address from callback data
    yield (0, add_raffle_actions_1.handleCreateRaffleWithoutReferral)(ctx, walletAddress);
}));
// -------------- create raffle end ------------
// -----------------------adding bot to group start-------------------
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
    const groupId = ctx.match[1];
    const existingRaffle = yield raffle_1.default.findOne({
        groupId: groupId,
        isActive: true,
    });
    if (existingRaffle) {
        yield ctx.reply("Raffle already exists and running in selected group.");
    }
    else {
        yield ctx.reply("Add Raffle option selected");
        ctx.session.groupId = groupId;
        ctx.scene.enter("raffleScene");
    }
}));
bot.action(/^UPDATE_RAFFLE_(.*)/, (ctx) => __awaiter(void 0, void 0, void 0, function* () {
    yield ctx.deleteMessage();
    ctx.scene.enter("updateRaffleScene");
}));
bot.action(/^VIEW_RAFFLE_(.*)/, (ctx) => __awaiter(void 0, void 0, void 0, function* () {
    if (state_1.prevMessageState.prevMessage) {
        yield ctx.deleteMessage(state_1.prevMessageState.prevMessage.message_id);
    }
    const groupId = ctx.match[1];
    // Handle the logic for viewing raffle details
    yield ctx.reply(`Viewing raffle details for group ID: ${groupId}`);
}));
// -----------------------adding bot to group end-------------------
// ---------------------------- buy raffle start------------------------------
bot.command("lucky", (ctx) => __awaiter(void 0, void 0, void 0, function* () {
    ctx.scene.enter("buyRaffleScene");
}));
// Event listener for 'dmSent' to trigger action
buy_raffle_scene_2.botEventEmitter.on("dmSent", (_a) => __awaiter(void 0, [_a], void 0, function* ({ userId, ctx, raffleDetails }) {
    ctx.session.raffleDetails = raffleDetails;
    yield bot.handleUpdate(Object.assign(Object.assign({}, ctx.update), { message: {
            text: "sendmessageinprivatedm",
            chat: { id: userId },
            from: { id: userId },
        } }));
}));
// Action handler for 'sendmessageinprivatedm'
bot.action("sendmessageinprivatedm", (ctx) => __awaiter(void 0, void 0, void 0, function* () {
    yield ctx.scene.enter("buyRafflePaymentScene");
}));
// Action handler for wallet selection
bot.action(/buy_raffle_wallet_(.+)/, (ctx) => __awaiter(void 0, void 0, void 0, function* () {
    const selectedWallet = ctx.match[1];
    if (selectedWallet === "metamask") {
        yield ctx.reply("You selected Metamask application. Please proceed with the Metamask payment.");
        // Add your Metamask payment handling logic here
    }
    else {
        ctx.session.buyRaffleSelectedWalletAddress = selectedWallet;
        yield ctx.scene.enter("buyRaffleContractCallScene");
    }
}));
// ---------------------------- buy raffle end------------------------------
//--------------------my raffle start -------------------------
bot.command("my_raffles", (ctx) => __awaiter(void 0, void 0, void 0, function* () {
    yield ctx.scene.enter("myRaffle");
}));
//--------------------my raffle end -------------------------
//--------------history start----------------------------
bot.command("history", (ctx) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = ctx.message.from.id;
        const lastFiveCompletedRaffles = yield raffle_1.default.find({
            userId: userId,
            isActive: false,
        })
            .sort({ raffleId: -1 }) // Sort by raffleId in descending order
            .limit(5); // Limit to 5 raffles
        // Check if any completed raffles were found
        if (lastFiveCompletedRaffles.length === 0) {
            yield ctx.reply("❌ No completed raffles found.");
            return;
        }
        // Prepare a text to display the last 5 completed raffles
        let message = "🎉 *Last 5 Completed Raffles* 🎉\n\n";
        lastFiveCompletedRaffles.forEach((raffle, index) => {
            message += `*${index + 1}.*`;
            message += `🏆 *Raffle ID*: \`${raffle.raffleId}\`\n`;
            message += `👤 *Winner*: ${raffle.winner || "Unknown"}\n`;
            message += `🎟️ *Raffle Title*: _${raffle.raffleTitle}_\n`;
            message += `\n-------------------\n\n`;
        });
        // Send the message to the user
        yield ctx.replyWithMarkdown(message); // Using Markdown formatting
    }
    catch (error) {
        console.error("Error fetching completed raffles:", error);
        yield ctx.reply("⚠️ An error occurred while fetching the raffle history. Please try again later.");
    }
}));
bot.command("cancel", (ctx) => {
    ctx.reply("Cancelling the current operation...");
    ctx.scene.leave();
});
bot.hears(["start", "/cancel", "/wallets"], () => {
    console.log("hears");
});
(0, connect_db_1.default)();
if (process.env.NODE_ENV === "development") {
    bot.launch(() => {
        console.log("Bot is running in dev mode");
    });
}
else if (process.env.NODE_ENV === "production") {
    const app = (0, express_1.default)();
    app.use(express_1.default.json());
    app.use((0, cors_1.default)());
    app.use(bot.webhookCallback("/secret-path"));
    bot.telegram.setWebhook(`${process.env.SERVER_URL}/secret-path`);
    app.get("/api/v1/global-metrics", global_metrics_1.handleGlobalMetrics);
    app.get("/api/v1/active-raffles", active_raffles_1.handleActiveRaffles);
    app.get("/api/v1/completed-raffles", completed_raffles_1.handleCompletedRaffles);
    app.get("/api/v1/revenue-distribution", revenuedistribution_1.handleRevenueDistribution);
    app.get("/api/v1/raffle-pool", raffle_pool_1.handleRafflePool);
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
}
// Enable graceful stop
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
//# sourceMappingURL=index.js.map