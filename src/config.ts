// Define types for CHAIN configuration
type ChainConfig = {
  rpcUrl?: string;
  explorerUrl?: string;
  name?: string;
  currency?: string;
  cbActionKey?: string;
};

type Chains = {
  [key: string]: ChainConfig;
};

// Define CHAIN object with type
export const CHAIN: Chains = {
  sepolia: {
    rpcUrl:
      "https://eth-sepolia.g.alchemy.com/v2/WRfmzLBj8D-0bD76QLpD7DjZu5rUIAtE",
  },
  "mumbai-testnet": {
    rpcUrl:
      "https://polygon-amoy.g.alchemy.com/v2/NeEbQDi3yU9wRy7OsVEmYF4dpyRaKm1I",
    explorerUrl: "https://mumbai.polygonscan.com",
    name: "Mumbai Testnet",
    currency: "ETH",
    cbActionKey: "polygon-mumbai-testnet",
  },
};

// Define the bot name
export const BOT_NAME: string = "LuckyDogRaffle";

// Define the ABI for the Coin Flip contract
export const RAFFLE_ABI: any[] = [
  {
    inputs: [
      { internalType: "address", name: "_serviceWallet", type: "address" },
    ],
    stateMutability: "nonpayable",
    type: "constructor",
  },
  {
    inputs: [{ internalType: "address", name: "owner", type: "address" }],
    name: "OwnableInvalidOwner",
    type: "error",
  },
  {
    inputs: [{ internalType: "address", name: "account", type: "address" }],
    name: "OwnableUnauthorizedAccount",
    type: "error",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "previousOwner",
        type: "address",
      },
      {
        indexed: true,
        internalType: "address",
        name: "newOwner",
        type: "address",
      },
    ],
    name: "OwnershipTransferred",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "uint256",
        name: "raffleId",
        type: "uint256",
      },
      {
        indexed: true,
        internalType: "address",
        name: "admin",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "entryCost",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "raffleEndTime",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "maxTickets",
        type: "uint256",
      },
    ],
    name: "RaffleCreated",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "uint256",
        name: "raffleId",
        type: "uint256",
      },
      {
        indexed: true,
        internalType: "address",
        name: "winner",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "prizeAmount",
        type: "uint256",
      },
    ],
    name: "RaffleEnded",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "uint256",
        name: "raffleId",
        type: "uint256",
      },
      {
        indexed: true,
        internalType: "address",
        name: "participant",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "numTickets",
        type: "uint256",
      },
    ],
    name: "TicketPurchased",
    type: "event",
  },
  {
    inputs: [],
    name: "REFERRER_FEE_PERCENTAGE",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "SERVICE_FEE_PERCENTAGE_WITHOUT_REFERRER",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "SERVICE_FEE_PERCENTAGE_WITH_REFERRER",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "uint256", name: "_raffleId", type: "uint256" },
      { internalType: "uint256", name: "_numTickets", type: "uint256" },
    ],
    name: "buyTickets",
    outputs: [],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [{ internalType: "bytes", name: "", type: "bytes" }],
    name: "checkUpkeep",
    outputs: [
      { internalType: "bool", name: "upkeepNeeded", type: "bool" },
      { internalType: "bytes", name: "performData", type: "bytes" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "uint256", name: "_entryCost", type: "uint256" },
      { internalType: "uint256", name: "_raffleStartTime", type: "uint256" },
      { internalType: "uint256", name: "_raffleEndTime", type: "uint256" },
      { internalType: "uint256", name: "_maxTickets", type: "uint256" },
      { internalType: "address", name: "_tgOwner", type: "address" },
      { internalType: "uint256", name: "_tgOwnerPercentage", type: "uint256" },
      { internalType: "uint256", name: "_maxBuyPerWallet", type: "uint256" },
      { internalType: "address", name: "_referrer", type: "address" },
    ],
    name: "createRaffle",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "_raffleId", type: "uint256" }],
    name: "endRaffle",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "_raffleId", type: "uint256" }],
    name: "getRaffleDetails",
    outputs: [
      { internalType: "address", name: "admin", type: "address" },
      { internalType: "address", name: "tgOwner", type: "address" },
      { internalType: "address", name: "winner", type: "address" },
      { internalType: "uint256", name: "entryCost", type: "uint256" },
      { internalType: "uint256", name: "raffleStartTime", type: "uint256" },
      { internalType: "uint256", name: "raffleEndTime", type: "uint256" },
      { internalType: "uint256", name: "maxTickets", type: "uint256" },
      { internalType: "bool", name: "isActive", type: "bool" },
      { internalType: "uint256", name: "tgOwnerPercentage", type: "uint256" },
      { internalType: "uint256", name: "maxBuyPerWallet", type: "uint256" },
      { internalType: "address", name: "referrer", type: "address" },
      { internalType: "uint256", name: "ticketsSold", type: "uint256" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "uint256", name: "raffleID", type: "uint256" },
      { internalType: "address", name: "user", type: "address" },
    ],
    name: "getTicketsByUser",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "owner",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "uint256", name: "", type: "uint256" },
      { internalType: "uint256", name: "", type: "uint256" },
    ],
    name: "participants",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "bytes", name: "performData", type: "bytes" }],
    name: "performUpkeep",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "raffleCounter",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    name: "raffles",
    outputs: [
      { internalType: "address", name: "admin", type: "address" },
      { internalType: "address", name: "tgOwner", type: "address" },
      { internalType: "address", name: "winner", type: "address" },
      { internalType: "address", name: "referrer", type: "address" },
      { internalType: "uint256", name: "entryCost", type: "uint256" },
      { internalType: "uint256", name: "raffleStartTime", type: "uint256" },
      { internalType: "uint256", name: "raffleEndTime", type: "uint256" },
      { internalType: "uint256", name: "maxTickets", type: "uint256" },
      { internalType: "bool", name: "isActive", type: "bool" },
      { internalType: "uint256", name: "tgOwnerPercentage", type: "uint256" },
      { internalType: "uint256", name: "maxBuyPerWallet", type: "uint256" },
      { internalType: "uint256", name: "ticketsSold", type: "uint256" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "renounceOwnership",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "serviceWallet",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "uint256", name: "_raffleId", type: "uint256" },
      { internalType: "uint256", name: "_maxBuyPerWallet", type: "uint256" },
    ],
    name: "setMaxPurchaseLimit",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "uint256", name: "", type: "uint256" },
      { internalType: "address", name: "", type: "address" },
    ],
    name: "ticketsBoughtPerWallet",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "totalServiceFees",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "newOwner", type: "address" }],
    name: "transferOwnership",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "withdrawServiceFees",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
];
// Define the contract address
export const RAFFLE_cONTRACT: string = "0x4652c3c335F1644beb68c55632c9DD8268aeb676";
