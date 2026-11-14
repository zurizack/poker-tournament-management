import mongoose from "mongoose";
import { levelSchema } from "./levelSchema.js";

// A manager's saved blind-structure blueprint. Deliberately excludes
// players/clock/status — those only exist on a live ActiveTournament.
const templateSchema = new mongoose.Schema(
  {
    ownerUsername: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true },
    levels: { type: [levelSchema], required: true },
    startingStack: { type: Number, required: true },
  },
  { timestamps: true },
);

export const TournamentTemplate = mongoose.model("TournamentTemplate", templateSchema);
