import mongoose from "mongoose";

const referralSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
  },
  walletAddress: {
    type: String,
    required: true,
    unique: true,
  },
  referralCode: {
    type: String,
    required: true,
    unique: true,
  },
});

const Referral = mongoose.model("Referral", referralSchema);

export default Referral;
