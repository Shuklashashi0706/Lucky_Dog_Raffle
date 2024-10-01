import Raffle from "../models/raffle";
export const handleActiveRaffles = async (req, res) => {
  try {
    const activeRafflesCount = await Raffle.countDocuments({ isActive: true });
    const ticketBoundRafflesCount = await Raffle.countDocuments({
      raffleEndTime: 0,
      isActive: true,
    });
    const activeRaffleCount = await Raffle.countDocuments({ isActive: true });
    const timeBoundRafflesCount = activeRaffleCount - ticketBoundRafflesCount;
    res.json({
      activeRafflesCount,
      ticketBoundRafflesCount,
      timeBoundRafflesCount,
    });
    
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
