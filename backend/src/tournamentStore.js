import { randomInt } from "crypto";
import { Tournament } from "./tournament.js";
import { ActiveTournament } from "./models/ActiveTournament.js";

// In-memory tournament registry, keyed by a 6-digit PIN. This stays the
// hot-path source of truth for the life of the process; Mongo is a durable
// backing store that's rehydrated into this Map once at boot (see
// loadActiveTournamentsFromDB) and kept in sync on every mutating action
// (best-effort — see persistTournament's callers in index.js).
const tournaments = new Map();

function generatePin() {
  let pin;
  do {
    pin = String(randomInt(100000, 1000000));
  } while (tournaments.has(pin));
  return pin;
}

// Single upsert primitive reused by every write path (initial create,
// manager actions, tick-driven level advances, post-rehydrate catch-up).
export async function persistTournament(tournament) {
  await ActiveTournament.findOneAndUpdate(
    { _id: tournament.id },
    { $set: tournament.toPersistableState() },
    { upsert: true },
  );
}

export async function createTournament(ownerUsername, seed = {}) {
  const id = generatePin();
  const tournament = new Tournament(id, ownerUsername);
  if (seed.levels) tournament.clock.setLevels(seed.levels);
  if (seed.startingStack) tournament.setStartingStack(seed.startingStack);
  if (seed.templateId) tournament.templateId = seed.templateId;

  tournaments.set(id, tournament);
  try {
    await persistTournament(tournament);
  } catch (err) {
    console.error(`[persist] initial save failed for tournament ${id}:`, err);
  }
  return tournament;
}

// Called once at boot, after connectDB() and before the server accepts
// traffic, so generatePin()'s in-memory collision check is always correct
// without an extra Mongo round-trip per PIN generation.
export async function loadActiveTournamentsFromDB() {
  const docs = await ActiveTournament.find({}).lean();
  for (const doc of docs) {
    const tournament = Tournament.fromPersistedState(doc);
    if (tournament.clock.catchUp()) {
      persistTournament(tournament).catch((err) =>
        console.error(`[persist] catch-up save failed for tournament ${tournament.id}:`, err),
      );
    }
    tournaments.set(tournament.id, tournament);
  }
  console.log(`[db] Rehydrated ${docs.length} active tournament(s)`);
}

export function getTournament(id) {
  return tournaments.get(id);
}

// Ended tournaments are excluded from all three queries below (dashboard
// sections) and from allTournaments() (tick loop) but stay in the Map and in
// Mongo — getTournament() still finds them directly by PIN so a player with
// the link sees an "ended" state instead of "not found", and the history
// isn't lost. Split into three focused queries (rather than one combined
// list) so the dashboard can render distinct My/Pending/Managed sections.
function notEnded(t) {
  return t.status !== "ended";
}

export function listOwnedTournaments(username) {
  return Array.from(tournaments.values()).filter((t) => t.ownerUsername === username && notEnded(t));
}

export function listPendingInvitations(username) {
  return Array.from(tournaments.values()).filter((t) => t.pendingAdmins.includes(username) && notEnded(t));
}

export function listManagedTournaments(username) {
  return Array.from(tournaments.values()).filter((t) => t.admins.includes(username) && notEnded(t));
}

export function allTournaments() {
  return Array.from(tournaments.values()).filter((t) => t.status !== "ended");
}
