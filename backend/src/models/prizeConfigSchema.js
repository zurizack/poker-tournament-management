import mongoose from "mongoose";

// Shared by TournamentTemplate and ActiveTournament (and snapshotted into
// TournamentHistory) — mirrors levelSchema.js's pattern of a plain,
// renaming-free shape so prizePool.js's pure functions can consume these
// documents directly after .lean()/toObject(). Payout structure only —
// buyInAmount/rebuyAmount/addOnAmount live as top-level tournament fields
// (see ActiveTournament.js) alongside startingStack/allowRebuys, since they
// describe the tournament itself rather than how its pool gets paid out.
export const prizeConfigSchema = new mongoose.Schema(
  {
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
