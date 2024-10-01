import GlobalMetrics from "../models/global-metrics";
import Raffle from "../models/raffle";
export const handleGlobalMetrics = async (req, res) => {
  try {
    const [raffleCount, metrics] = await Promise.all([
      Raffle.countDocuments({}),
      GlobalMetrics.findOne({}),
    ]);

    if (!metrics) {
      return res.status(404).json({ message: "No global metrics found" });
    }
    res.json({
      raffleCount,
      metrics,
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
