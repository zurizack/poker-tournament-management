import mongoose from "mongoose";

// Shared by TournamentTemplate and ActiveTournament so a persisted level is
// byte-identical to the plain objects levels.js/tournamentClock.js already
// pass around — no field renaming at the Mongoose boundary.
export const levelSchema = new mongoose.Schema(
  {
    level: Number,
    smallBlind: Number,
    bigBlind: Number,
    ante: Number,
    durationSeconds: Number,
    isBreak: Boolean,
  },
  { _id: false },
);
