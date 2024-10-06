import Raffle from "../models/raffle";

export const handleCompletedRaffles = async (req, res) => {
  try {
    // Query to find all raffles where isActive is false (completed raffles)
    const totalCompletedRaffles = await Raffle.countDocuments({
      isActive: false,
    });

    // Query to find raffles that are time-based completed (raffleStartTime > 0 and maxTickets = 0)
    const timeBasedCompletedRaffles = await Raffle.countDocuments({
      isActive: false,
      raffleEndTime: { $gt: 0 },
      maxTickets: 0,
    });

    // Query to find raffles that are ticket-based completed (raffleStartTime = 0 and maxTickets > 0)
    const ticketBasedCompletedRaffles = await Raffle.countDocuments({
      isActive: false,
      raffleEndTime: 0,
      maxTickets: { $gt: 0 },
    });

    res.status(200).json({
      message: "successfull",
      totalCompletedRaffles: totalCompletedRaffles,
      timeBasedCompletedRaffles: timeBasedCompletedRaffles,
      ticketBasedCompletedRaffles: ticketBasedCompletedRaffles,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
