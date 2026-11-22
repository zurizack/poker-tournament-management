import mongoose from "mongoose";
import { levelSchema } from "./levelSchema.js";
import { prizeConfigSchema } from "./prizeConfigSchema.js";

const playerSchema = new mongoose.Schema(
  {
    id: String,
    name: String,
    status: String,
    buyIns: Number,
    rebuys: Number,
    addOns: Number,
  },
  { _id: false },
);

// levelEndTimestamp is stored as a Number (epoch ms), not a Date, because the
// runtime clock is built entirely on Date.now() arithmetic — this keeps the
// persist/rehydrate round-trip a pure pass-through with no conversion.
const clockSchema = new mongoose.Schema(
  {
    status: String,
    currentLevelIndex: Number,
    remainingMs: Number,
    levelEndTimestamp: { type: Number, default: null },
    levels: { type: [levelSchema], required: true },
  },
  { _id: false },
);

// Generic shape — different event types populate different optional fields
// (see Tournament#_logEvent). Kept loose rather than a discriminated union
// since this is write-once-per-event and read back verbatim into history.
const eventSchema = new mongoose.Schema(
  {
    type: { type: String, required: true },
    timestamp: { type: Number, required: true },
    fromLevelIndex: Number,
    toLevelIndex: Number,
    previousLevelCount: Number,
    newLevelCount: Number,
    previousValue: Number,
    newValue: Number,
  },
  { _id: false },
);

// _id is the 6-digit PIN itself (not an ObjectId) — it's already the public
// identifier used in socket room names and frontend routes, so this avoids a
// separate PIN<->ObjectId mapping.
const activeTournamentSchema = new mongoose.Schema(
  {
    _id: { type: String },
    ownerUsername: { type: String, required: true, index: true },
    createdAt: { type: Number, required: true },
    startingStack: { type: Number, required: true },
    templateId: { type: mongoose.Schema.Types.ObjectId, ref: "TournamentTemplate", default: null },
    status: { type: String, enum: ["active", "ended"], default: "active" },
    admins: { type: [String], default: [] },
    pendingAdmins: { type: [String], default: [] },
    name: { type: String, default: "" },
    allowRebuys: { type: Boolean, default: true },
    rebuyLimitType: { type: String, enum: ["unlimited", "limited"], default: "unlimited" },
    maxRebuysPerPlayer: { type: Number, default: null },
    allowAddOn: { type: Boolean, default: false },
    buyInAmount: { type: Number, default: 0 },
    rebuyAmount: { type: Number, default: 0 },
    addOnAmount: { type: Number, default: 0 },
    prizeConfig: { type: prizeConfigSchema, default: () => ({}) },
    quickPlayerCounter: { type: Number, default: 0 },
    clock: { type: clockSchema, required: true },
    players: { type: [playerSchema], default: [] },
    events: { type: [eventSchema], default: [] },
    startedAt: { type: Number, default: null },
  },
  { timestamps: false },
);

export const ActiveTournament = mongoose.model("ActiveTournament", activeTournamentSchema);
