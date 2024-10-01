import mongoose from "mongoose";
const globalMetricsSchema = new mongoose.Schema(
  {
    userId: {
      type: Number,
      default: 0,
    },
    totalTicketsPurchased: {
      type: Number,
      default: 0,
    },
    totalRegisteredUsers: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

const GlobalMetrics = mongoose.model("GlobalMetrics", globalMetricsSchema);
export default GlobalMetrics;
