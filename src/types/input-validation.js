const { z } = require("zod");
import { ethers } from "ethers";

export const raffleTitleSchema = z
  .string()
  .min(1, "Raffle title cannot be empty.");
export const ticketPriceSchema = z.string().refine(
  (val) => {
    const parsedValue = parseFloat(val);
    return (
      !isNaN(parsedValue) &&
      parsedValue > 0 &&
      val.trim() === parsedValue.toString()
    );
  },
  {
    message:
      "Ticket price must be a positive number and should not contain any non-numeric characters.",
  }
);
export const splitPercentSchema = z.string().refine(
  (val) => {
    const num = parseInt(val, 10);
    return num >= 0 && num <= 39;
  },
  { message: "Split percentage must be between 0 and 39." }
);
export const walletAddressSchema = z
  .string()
  .refine((val) => ethers.utils.isAddress(val), {
    message: "Invalid wallet address.",
  });
export const startTimeSchema = z
  .string()
  .regex(
    /^(\d+d\s)?\d+(\.\d+)?h$/,
    "Invalid time format. Use 'Xd Yh' format with whole or decimal hours."
  )
  .refine(
    (input) => {
      const timeMatch = input.match(/^(\d+d\s)?(\d+(\.\d+)?)h$/);
      if (!timeMatch) return false; 

      const days = timeMatch[1]
        ? parseInt(timeMatch[1].replace("d", "").trim(), 10)
        : 0;
      const hours = parseFloat(timeMatch[2]);
      const totalHours = days * 24 + hours;
      return totalHours >= 1;
    },
    {
      message:
        "Time must be at least 0d 1h and use whole or decimal hours.",
    }
  )
  .refine(
    (input) => {
      const timeMatch = input.match(/^(\d+d\s)?(\d+(\.\d+)?)h$/);
      if (timeMatch && timeMatch[2] && parseFloat(timeMatch[2]) > 24) {
        return false;
      }
      return true;
    },
    {
      message: "Hours must be less than 24 for a valid time input.",
    }
  );
export const raffleLimitSchema = z.string().refine(
  (val) => {
    const number = parseInt(val, 10);
    return !isNaN(number) && number > 0 && number <= 1000000;
  },
  {
    message: "Raffle limit must be a positive integer between 1 and 1000000.",
  }
);

export const maxTicketsSchema = z.string().refine(
  (val) => {
    const number = parseInt(val, 10);
    return !isNaN(number) && number > 0 && number <= 1000;
  },
  {
    message: "Max tickets must be a positive integer between 1 and 1000.",
  }
);
export const raffleDescriptionSchema = z
  .string()
  .min(1, "Raffle Description cannot be empty.");
