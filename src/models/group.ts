import mongoose, { Document, Schema, model } from "mongoose";

// Define an interface for the Group document
interface IGroup extends Document {
  groupId: string;
  groupUsername: string;
  botId: string;
  botUsername: string;
  username: string;
  userId: string;
  raffleId: mongoose.Types.ObjectId; // Assuming raffleId is a reference to Raffle
}

// Create the Group schema
const groupSchema = new Schema<IGroup>({
  groupId: { type: String, required: true },
  groupUsername: { type: String, required: true },
  botId: { type: String, required: true },
  botUsername: { type: String, required: true },
  username: { type: String, required: true },
  userId: { type: String, required: true },
  raffleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Raffle",
  }, // Reference to Raffle model
});

// Create the Group model
const Group = model<IGroup>("Group", groupSchema);

export default Group;
