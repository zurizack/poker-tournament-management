import mongoose from "mongoose";

// Fails fast at boot on a missing/unreachable MONGO_URI — once persistence
// exists, silently falling back to in-memory-only would let the server look
// healthy while quietly losing every active tournament on the next restart.
// Reconnection after the initial connect is handled by Mongoose itself; a
// transient outage during normal operation never crashes the process (see
// the best-effort persistTournament() callers in tournamentStore.js).
export async function connectDB() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    throw new Error("MONGO_URI is not set");
  }

  mongoose.connection.on("disconnected", () => console.error("[db] MongoDB disconnected"));
  mongoose.connection.on("reconnected", () => console.log("[db] MongoDB reconnected"));

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
  console.log("[db] Connected to MongoDB");
}
