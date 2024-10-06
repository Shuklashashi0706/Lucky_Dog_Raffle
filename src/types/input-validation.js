const { z } = require("zod");

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
  .regex(/^(\d+d\s)?\d+h$/, "Invalid start time format. Use 'Xd Yh' format.");
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
    message:
      "Max tickets per wallet must be a positive integer between 1 and 1000.",
  }
);
export const raffleDescriptionSchema = z
  .string()
  .min(1, "Raffle Description cannot be empty.");
