import Raffle from "../models/raffle";
export const handleRafflePool = async (req, res) => {
  const isActive = req.query.isActive;
  try {
    const topRaffles = await Raffle.find({ isActive })
      .sort({ rafflePool: -1 })
      .limit(20);

    res.json(topRaffles);
  } catch (error) {
    console.error("Error fetching raffles:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};
