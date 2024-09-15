import mongoose from "mongoose";

const raffleSchema = new mongoose.Schema({
  createdBy: { type: String, required: true },
  raffleStatus: { type: String, enum: ["RUNNING", "COMPLETED"], required: true },
  createdGroup: { type: String },
  raffleTitle: { type: String, required: true },
  rafflePrice: { type: Number, required: true },
  splitPool: { type: String, enum: ["YES", "NO"] },
  splitPercentage: { type: Number },
  ownerWalletAddress: { type: String },
  startTimeOption: { type: String, enum: ["NOW", "SELECT"] },
  startTime: { type: String },
  raffleLimitOption: {
    type: String,
    enum: ["TIME_BASED", "VALUE_BASED"],
  },
  raffleEndTime: { type: String, default: null },
  raffleEndValue: { type: Number, default: null },
  rafflePurpose: { type: String, required: true },
});

const Raffle = mongoose.model("Raffle", raffleSchema);

export default Raffle;
