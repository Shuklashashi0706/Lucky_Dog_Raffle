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
const importWalletScene_1 = require("./scenes/importWalletScene");
const generateWalletSeedScene_1 = require("./scenes/generateWalletSeedScene");
const importWalletScene_2 = require("./scenes/importWalletScene");
const chooseWalletNameScene_1 = require("./scenes/chooseWalletNameScene");
const generateWalletSeedScene_2 = require("./scenes/generateWalletSeedScene");
const playAmountScene_1 = require("./scenes/playAmountScene");
const bot_utils_2 = require("./utils/bot-utils");
const bot_utils_3 = require("./utils/bot-utils");
const state_1 = require("./utils/state");
const message_utils_1 = require("./utils/message-utils");
const handle_lucky_command_1 = require("./scenes/handle-lucky-command");
dotenv_1.default.config();
if (!process.env.TELEGRAM_BOT_TOKEN) {
    console.error("Setup your token");
    process.exit(1);
}
const bot = new telegraf_1.Telegraf("7518728844:AAEoJq_x2GZyn20GstLgbfskoCsWLLf3TGU");
const stage = new telegraf_1.Scenes.Stage([
    importWalletScene_2.importWalletStep,
    chooseWalletNameScene_1.chooseWalletNameStep,
    generateWalletSeedScene_2.generateWalletSeedStep,
    playAmountScene_1.playAmountStep,
]);
bot.use((0, telegraf_1.session)());
bot.use(stage.middleware());
// Set up bot commands and actions
bot.start((ctx) => {
    state_1.prevMessageState.prevMessage = ctx.reply("Welcome to Lucky Dog Raffle Bot! Telegram's Original Buy Bot! What would you like to do today? \n/menu", telegraf_1.Markup.inlineKeyboard([
        telegraf_1.Markup.button.callback("➕ Add a Raffle", "ADD_RAFFLE"),
    ]));
});
// -----------------------  wallet setup start -----------------------------
// back buttons
bot.action("back-to-main-menu", (ctx) => __awaiter(void 0, void 0, void 0, function* () {
    ctx.deleteMessage();
    delete ctx.session.selectedDeleteWalletName;
    delete ctx.session.selectedPlayWalletName;
    delete ctx.session.selectedRefundWalletName;
    yield (0, bot_utils_1.menuCommand)(ctx, ctx.session.wallets);
}));
bot.command("wallets", (ctx) => __awaiter(void 0, void 0, void 0, function* () {
    console.log("wallet");
    yield (0, bot_utils_1.walletsCommand)(ctx, ctx.session.wallets);
}));
bot.command("lucky", (ctx) => __awaiter(void 0, void 0, void 0, function* () {
    console.log("lulcky");
    (0, handle_lucky_command_1.handleLuckyCommand)(ctx, bot);
}));
// create wallet buttons
bot.action("import-existing-wallet", (ctx) => {
    ctx.scene.enter(importWalletScene_1.importWalletScene);
});
bot.action("generate-wallet-seed", (ctx) => {
    ctx.scene.enter(generateWalletSeedScene_1.generateWalletSeedScene);
});
// delete buttons
bot.action("btn-delete-wallet", (ctx) => __awaiter(void 0, void 0, void 0, function* () {
    ctx.deleteMessage();
    yield (0, bot_utils_2.btnDeleteWalletAction)(ctx, ctx.session.wallets);
}));
bot.action(/^delete-wallet-/, (ctx) => __awaiter(void 0, void 0, void 0, function* () {
    ctx.deleteMessage();
    const walletName = ctx.update.callback_query.data.split("-")[2];
    ctx.session.selectedDeleteWalletName = walletName;
    const wallet = (0, bot_utils_3.getWalletByName)(ctx, walletName);
    yield (0, bot_utils_3.dynamicDeleteWalletAction)(ctx, wallet);
}));
bot.action("confirm-delete-wallet", (ctx) => __awaiter(void 0, void 0, void 0, function* () {
    ctx.deleteMessage();
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
// adding bot to group
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
bot.action("ADD_RAFFLE", (ctx) => {
    if (state_1.prevMessageState.prevMessage)
        (0, message_utils_1.deletePreviousMessage)(ctx);
    (0, add_raffle_actions_1.handleAddRaffle)(ctx);
});
bot.on("text", (ctx) => {
    if (state_1.prevMessageState.prevMessage)
        (0, message_utils_1.deletePreviousMessage)(ctx);
    (0, add_raffle_actions_1.handleTextInputs)(ctx);
});
// handle split percentage for raffle
bot.action("SPLIT_YES", (ctx) => {
    if (state_1.prevMessageState.prevMessage)
        (0, message_utils_1.deletePreviousMessage)(ctx);
    (0, add_raffle_actions_1.handleSplitPool)(ctx);
});
bot.action("SPLIT_NO", (ctx) => {
    if (state_1.prevMessageState.prevMessage)
        (0, message_utils_1.deletePreviousMessage)(ctx);
    (0, add_raffle_actions_1.handleNoSplitPool)(ctx);
});
// handle the raffle start time
bot.action("START_NOW", (ctx) => {
    if (state_1.prevMessageState.prevMessage)
        (0, message_utils_1.deletePreviousMessage)(ctx);
    (0, add_raffle_actions_1.handleStartRaffleNow)(ctx);
});
bot.action("SELECT_TIME", (ctx) => {
    if (state_1.prevMessageState.prevMessage)
        (0, message_utils_1.deletePreviousMessage)(ctx);
    (0, add_raffle_actions_1.handleSelectTime)(ctx);
});
// handle raffle limit
bot.action("TIME_BASED", (ctx) => {
    if (state_1.prevMessageState.prevMessage)
        (0, message_utils_1.deletePreviousMessage)(ctx);
    (0, add_raffle_actions_1.handleTimeBasedLimit)(ctx);
});
bot.action("VALUE_BASED", (ctx) => {
    if (state_1.prevMessageState.prevMessage)
        (0, message_utils_1.deletePreviousMessage)(ctx);
    (0, add_raffle_actions_1.handleValueBasedLimit)(ctx);
});
// confirm details
bot.action("CONFIRM_DETAILS", (ctx) => __awaiter(void 0, void 0, void 0, function* () {
    if (state_1.prevMessageState.prevMessage)
        (0, message_utils_1.deletePreviousMessage)(ctx);
    (0, add_raffle_actions_1.handleConfirmDetails)(ctx);
}));
bot.action("CANCEL_ADD_RAFL", (ctx) => {
    if (state_1.prevMessageState.prevMessage)
        (0, message_utils_1.deletePreviousMessage)(ctx);
    (0, add_raffle_actions_1.handleCancel)(ctx);
});
bot.action(/buy_ticket_(\d+)_(\w+)/, (ctx) => __awaiter(void 0, void 0, void 0, function* () {
    (0, handle_lucky_command_1.handleBuyTicket)(ctx);
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
//# sourceMappingURL=index.js.map