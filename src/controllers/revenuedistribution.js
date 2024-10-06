import { TotalRevenueDistributionModel } from "../models/total_revenue";

export const handleRevenueDistribution = async (req, res) => {
  try {
    const revenueDistribution = await TotalRevenueDistributionModel.findOne();

    if (!revenueDistribution) {
      return res
        .status(404)
        .json({ message: "No revenue distribution data found." });
    }

    const platformRevenueEth = revenueDistribution.platformRevenue;
    const tgOwnerRevenueEth = revenueDistribution.tgOwnerRevenue;
    const referrerEarningsEth = revenueDistribution.referrerEarnings;

    return res.status(200).json({
      message: "Successful",
      platformRevenue: platformRevenueEth,
      tgOwnerRevenue: tgOwnerRevenueEth,
      referrerEarnings: referrerEarningsEth,
    });
  } catch (error) {
    console.error("Error fetching revenue distribution:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};
