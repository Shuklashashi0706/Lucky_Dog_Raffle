import mongoose from "mongoose";

const raffleSchema = new mongoose.Schema({
  raffleStartTime: { type: Number, default: null },
  raffleEndTime: { type: Number, default: null },
  raffleId: { type: Number, required: true, unique: true },
  admin: { type: String, required: true },
  entryCost: { type: Number, required: true },
  maxTickets: { type: Number },
  tgOwner: { type: String },
  tgOwnerPercentage: { type: Number },
  maxBuyPerWallet: { type: Number },
  referrer: { type: String },
  isActive: { type: Boolean, default: true },
  groupId: { type: String },
});

const Raffle = mongoose.model("Raffle", raffleSchema);

export default Raffle;
