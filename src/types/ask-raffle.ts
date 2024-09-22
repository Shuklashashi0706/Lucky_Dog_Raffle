const { z } = require("zod");

const durationRegex = /^(\d+d\s?)?(\d+h\s?)?$/;
const dateTimeRegex = /^\d{2}-\d{2}-\d{4} \d{2}:\d{2}$/;

//schema for validating inputs
const userStateSchema = z.object({
  raffleTitle: z.string().min(1, "Raffle title is required"),
  rafflePrice: z
    .number()
    .nonnegative("Raffle price must be a non-negative number"),
  splitPercentage: z.number().min(0).max(100).optional(),
  ownerWalletAddress: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address")
    .optional(),
  startTimeOption: z.enum(["NOW", "SELECT"]),
  startTime: z
    .string()
    .regex(durationRegex, "Invalid date format, must be DD-MM-YYYY HH:MM")
    .optional(),
  raffleLimitOption: z.enum(["TIME_BASED", "VALUE_BASED"]),
  raffleEndTime: z
    .string()
    .regex(durationRegex, "Invalid duration format, must be 'Xd Yh'")
    .optional(),
  raffleEndValue: z.number().nonnegative().optional(),
  rafflePurpose: z.string().min(1, "Raffle description is required"),
});

const userStateFinalSchema = z.object({
  raffleTitle: z.string().min(1, "Raffle title is required"),
  rafflePrice: z
    .number()
    .nonnegative("Raffle price must be a non-negative number"),
  splitPool: z.enum(["YES", "NO"]), // Adding 'splitPool' field to match the input
  splitPercentage: z.number().min(0).max(100).optional(),
  ownerWalletAddress: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address")
    .optional(),
  startTimeOption: z.enum(["NOW", "SELECT"]),
  startTime: z
    .union([
      z.string().regex(/^\d+$/, "Invalid timestamp format, must be a Unix timestamp"), // Checks if it's a string timestamp
      z.number().int().positive("Start time must be a positive Unix timestamp") // Checks if it's a number timestamp
    ]),
  raffleLimitOption: z.enum(["TIME_BASED", "VALUE_BASED"]),
  raffleEndTime: z
    .union([
      z.string().regex(/^\d+$/, "Invalid timestamp format, must be a Unix timestamp"), // Checks if it's a string timestamp
      z.number().int().positive("End time must be a positive Unix timestamp") // Checks if it's a number timestamp
    ])
    .optional(),
  raffleEndValue: z.number().nonnegative().optional(),
  rafflePurpose: z.string().min(1, "Raffle description is required"),
  createdGroup: z.string().min(1, "Group ID is required"), // Assuming it's a string ID
  stage: z.string().min(1, "Stage is required"), // Validating 'stage' field
});

interface UserState {
  raffleTitle?: string;
  rafflePrice?: number;
  splitPool?: "YES" | "NO";
  groupId?: string;
  splitPercentage?: number;
  ownerWalletAddress?: string;
  startTimeOption?: "NOW" | "SELECT";
  startTime?: string;
  raffleLimitOption?: "TIME_BASED" | "VALUE_BASED";
  raffleEndTime?: string;
  raffleEndValue?: number;
  rafflePurpose?: string;
  stage?:
    | "ASK_RAFFLE_TITLE"
    | "ASK_RAFFLE_PRICE"
    | "ASK_SPLIT_POOL"
    | "ASK_SPLIT_PERCENT"
    | "ASK_WALLET_ADDRESS"
    | "ASK_RAFFLE_START_TIME"
    | "ASK_RAFFLE_LIMIT"
    | "ASK_RAFFLE_END_TIME"
    | "ASK_RAFFLE_VALUE"
    | "ASK_RAFFLE_PURPOSE"
    | "ASK_GROUP_ID"
    | "AWAITING_GROUP_SELECTION"
    | "CREATE_RAFFLE"
    | "CONFIRM_DETAILS";
}

export { UserState, userStateSchema,userStateFinalSchema };
