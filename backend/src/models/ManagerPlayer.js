import mongoose from "mongoose";

// A manager's persistent player directory (CRM) — separate from the
// per-tournament player entries on ActiveTournament/TournamentHistory,
// which only exist for the life of one tournament. Matching across
// tournaments is by name only (see nameKey), since per-tournament players
// have no stable identity of their own (random UUID per tournament).
const managerPlayerSchema = new mongoose.Schema(
  {
    ownerUsername: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true },
    // Normalized (trimmed + lowercased) copy of `name`, used only for the
    // case-insensitive uniqueness constraint and for matching incoming
    // tournament player names — never shown in the UI.
    nameKey: { type: String, required: true },
    nickname: { type: String, default: "" },
    notes: { type: String, default: "" },
    phone: { type: String, default: "" },
    tournamentsPlayed: { type: Number, default: 0 },
    lastPlayedAt: { type: Number, default: null },
  },
  { timestamps: true },
);

managerPlayerSchema.index({ ownerUsername: 1, nameKey: 1 }, { unique: true });

export const ManagerPlayer = mongoose.model("ManagerPlayer", managerPlayerSchema);
