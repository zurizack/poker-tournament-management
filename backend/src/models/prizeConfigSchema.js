import mongoose from "mongoose";

// Shared by TournamentTemplate and ActiveTournament (and snapshotted into
// TournamentHistory) — mirrors levelSchema.js's pattern of a plain,
// renaming-free shape so prizePool.js's pure functions can consume these
// documents directly after .lean()/toObject().
export const prizeConfigSchema = new mongoose.Schema(
  {
    buyInAmount: { type: Number, default: 0 },
    rebuyAmount: { type: Number, default: 0 },
    addOnAmount: { type: Number, default: 0 },
    manualPrizePoolEnabled: { type: Boolean, default: false },
    manualPrizePoolAmount: { type: Number, default: 0 },
    itmMode: { type: String, enum: ["percentage", "fixed"], default: "percentage" },
    itmPercent: { type: Number, default: 15 },
    itmFixedPlaces: { type: Number, default: 3 },
    payoutMode: { type: String, enum: ["formula", "custom"], default: "formula" },
    customPayouts: { type: [Number], default: [] },
  },
  { _id: false },
);
