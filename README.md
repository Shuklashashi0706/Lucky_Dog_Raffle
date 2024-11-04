# Lucky Dog Raffle 🎉

**Lucky Dog Raffle** is a Telegram bot designed to create, manage, and participate in Ethereum-based raffles. Built with Node.js and powered by the Telegraf framework, this bot provides an interactive way for users to engage in decentralized raffles on the Ethereum blockchain. 

## Features

- Easily create, join, and manage raffles directly on Telegram
- Blockchain integration with Ethereum for secure and transparent raffle handling
- MongoDB for data storage
- Configurable with environment variables for flexible deployment

## Prerequisites

- **Node.js**: Make sure Node.js (version 14 or later) is installed.
- **MongoDB**: Have access to a MongoDB instance for data persistence.
- **Alchemy API**: Set up an account on Alchemy (https://www.alchemy.com/) to obtain an Ethereum RPC API key for blockchain interactions.

## Setup Instructions

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/lucky-dog-raffle.git
cd lucky-dog-raffle
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Set Up Environment Variables

Create a `.env` file in the root directory based on the provided `.env.example` template. Replace the placeholder values with your actual configuration values.

```plaintext
TELEGRAM_BOT_TOKEN= "your_telegram_bot_token"
MONGO_URI = "your_mongo_db_uri"
SERVER_URL = "your_server_url"
NODE_ENV = "production"
ALCHEMY_RPC_API_KEY = "your_alchemy_rpc_api_key"
```

| Variable             | Description                                                                                   |
|----------------------|-----------------------------------------------------------------------------------------------|
| `TELEGRAM_BOT_TOKEN` | Your Telegram bot token from BotFather                                                       |
| `MONGO_URI`          | MongoDB URI for connecting to your MongoDB instance                                          |
| `SERVER_URL`         | The URL where this bot is hosted                                                             |
| `NODE_ENV`           | Set to "production" for a production environment or "development" for testing                |
| `ALCHEMY_RPC_API_KEY`| Your Alchemy Ethereum RPC API key to enable blockchain interaction                           |

### 4. Run the Bot

To start the bot in development mode:

```bash
npm run dev
```

To start the bot in production mode:

```bash
npm start
```

The bot should now be running and ready to handle raffle interactions on Telegram!

---

Enjoy creating and joining raffles securely and transparently with Lucky Dog Raffle! 🐾
