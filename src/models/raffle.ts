import mongoose from "mongoose";

const RaffleSchema = new mongoose.Schema(
  {
    raffleId: {
      type: String,
      required: true,
      unique: true,
    },
    raffleTitle: {
      type: String,
      required: true,
    },
    groupId: {
      type: String,
      required: true,
      unique: true, // to make only each raffle associated with single group
    },
    groupName: {
      type: String,
    },
    userId: {
      type: String,
      required: true,
    },
    botId: {
      type: String,
      required: true,
    },
    entryCost: {
      type: Number, // Represents _entryCost in the smart contract
      required: true,
      min: 0,
    },
    raffleStartTime: {
      type: Number, // Unix timestamp for the start time
      required: true,
    },
    raffleEndTime: {
      type: Number, // Unix timestamp for the end time, can be 0
      required: true,
    },
    completedTime: {
      type: Number,
      default: 0,
    },
    maxTickets: {
      type: Number, // Represents the maximum number of tickets, can be 0
      required: true,
    },
    tgOwner: {
      type: String, // Ethereum address of the TG owner
      required: true,
    },
    tgOwnerPercentage: {
      type: Number, // Percentage share in basis points (1 basis point = 0.01%)
      required: true,
      min: 0,
      max: 3900, // Max 39.00%
    },
    maxBuyPerWallet: {
      type: Number, // Maximum number of tickets a single wallet can purchase
      required: true,
      min: 1,
    },
    referrer: {
      type: String, // Ethereum address of the referrer
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    ticketsSold: {
      type: Number, // Number of tickets sold in this raffle
      default: 0,
    },
    rafflePool: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

const Raffle = mongoose.model("Raffle", RaffleSchema);

export default Raffle;
