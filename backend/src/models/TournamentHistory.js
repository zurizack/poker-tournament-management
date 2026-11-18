import mongoose from "mongoose";
import { levelSchema } from "./levelSchema.js";

const playerSnapshotSchema = new mongoose.Schema(
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

// Same generic shape as ActiveTournament's eventSchema, plus durationMs —
// attached only to "paused" events once historyStore pairs them with their
// matching "resumed" (or "tournament_ended") event at archive time.
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
    durationMs: Number,
  },
  { _id: false },
);

// Immutable archive written once when a tournament ends (see
// historyStore.createHistory). Deliberately a separate collection from
// ActiveTournament — rather than just flipping its status to "ended" — so
// a completed tournament's report can never be touched by the live
// gameplay write paths, and so this collection can be queried/indexed
// purely for historical reporting without competing with the hot path.
const tournamentHistorySchema = new mongoose.Schema(
  {
    tournamentId: { type: String, required: true, index: true },
    ownerUsername: { type: String, required: true, index: true },
    admins: { type: [String], default: [] },
    name: { type: String, required: true },
    startingStack: { type: Number, required: true },
    levels: { type: [levelSchema], required: true },
    allowRebuys: Boolean,
    rebuyLimitType: String,
    maxRebuysPerPlayer: Number,
    allowAddOn: Boolean,
    startedAt: { type: Number, default: null },
    endedAt: { type: Number, required: true },
    // Gross = wall-clock time from start to end. Active = gross minus total
    // paused time, i.e. how long the clock actually ran.
    grossDurationMs: { type: Number, required: true },
    activeDurationMs: { type: Number, required: true },
    totalEntries: Number,
    uniquePlayers: Number,
    totalRebuys: Number,
    totalAddOns: Number,
    finalLevelIndex: Number,
    finalLevel: levelSchema,
    players: { type: [playerSnapshotSchema], default: [] },
    events: { type: [eventSchema], default: [] },
  },
  { timestamps: true },
);

export const TournamentHistory = mongoose.model("TournamentHistory", tournamentHistorySchema);
