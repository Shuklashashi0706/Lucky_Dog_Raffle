import mongoose from "mongoose";
const referralSchema = new mongoose.Schema({
    walletAddress: {
      type: String,
      required: true,
      unique: true,
    },
    referralCode: {
      type: String,
      required: true,
    },
  });

  export const ReferralCode = mongoose.model('ReferralCode', referralSchema);