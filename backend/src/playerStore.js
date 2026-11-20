import { ManagerPlayer } from "./models/ManagerPlayer.js";
import { TournamentHistory } from "./models/TournamentHistory.js";

function normalizeKey(name) {
  return (name || "").trim().toLowerCase();
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function createPlayer(ownerUsername, { name, nickname, notes, phone } = {}) {
  const trimmedName = (name || "").trim();
  if (!trimmedName) {
    throw new Error("Player name is required");
  }
  try {
    return await ManagerPlayer.create({
      ownerUsername,
      name: trimmedName,
      nameKey: normalizeKey(trimmedName),
      nickname: (nickname || "").trim(),
      notes: (notes || "").trim(),
      phone: (phone || "").trim(),
    });
  } catch (err) {
    if (err.code === 11000) throw new Error("A player with this name already exists");
    throw err;
  }
}

export function listPlayersByOwner(ownerUsername, { search, sort } = {}) {
  const filter = { ownerUsername };
  if (search?.trim()) {
    filter.name = new RegExp(escapeRegex(search.trim()), "i");
  }
  const sortSpec = sort === "name" ? { name: 1 } : { lastPlayedAt: -1, name: 1 };
  return ManagerPlayer.find(filter).sort(sortSpec).lean();
}

export async function updatePlayer(id, ownerUsername, updates) {
  const set = {};
  if (updates.name !== undefined) {
    const trimmedName = updates.name.trim();
    if (!trimmedName) throw new Error("Player name is required");
    set.name = trimmedName;
    set.nameKey = normalizeKey(trimmedName);
  }
  if (updates.nickname !== undefined) set.nickname = updates.nickname.trim();
  if (updates.notes !== undefined) set.notes = updates.notes.trim();
  if (updates.phone !== undefined) set.phone = updates.phone.trim();

  try {
    return await ManagerPlayer.findOneAndUpdate(
      { _id: id, ownerUsername },
      { $set: set },
      { new: true, runValidators: true },
    );
  } catch (err) {
    if (err.code === 11000) throw new Error("A player with this name already exists");
    return null; // malformed ObjectId -> treat as not-found, not a 500
  }
}

export async function deletePlayer(id, ownerUsername) {
  try {
    return await ManagerPlayer.findOneAndDelete({ _id: id, ownerUsername });
  } catch {
    return null;
  }
}

// Called when a player is seated in a live tournament. Ensures a directory
// entry exists and bumps lastPlayedAt immediately (via $max, so it never
// moves backward) — but deliberately does NOT touch tournamentsPlayed,
// since "seated" isn't "completed". That count only comes from
// recomputePlayerStatsForOwner, below, once the tournament actually ends.
export async function upsertPlayerSeen(ownerUsername, name) {
  const nameKey = normalizeKey(name);
  if (!nameKey) return;
  await ManagerPlayer.findOneAndUpdate(
    { ownerUsername, nameKey },
    {
      $max: { lastPlayedAt: Date.now() },
      $setOnInsert: { ownerUsername, nameKey, name, tournamentsPlayed: 0 },
    },
    { upsert: true },
  );
}

// Recomputes tournamentsPlayed/lastPlayedAt for every player belonging to
// `ownerUsername` directly from TournamentHistory (the source of truth),
// rather than incrementing a counter — so it's safe to call repeatedly
// (every tournament end, and once for every owner at boot for backfill)
// without any risk of double-counting or drift. Never touches
// name/nickname/notes/phone on an existing entry (only set on first
// insert), so manual edits in the directory are never clobbered.
export async function recomputePlayerStatsForOwner(ownerUsername) {
  const histories = await TournamentHistory.find({ ownerUsername }, { players: 1, endedAt: 1 }).lean();

  const stats = new Map();
  for (const history of histories) {
    for (const player of history.players ?? []) {
      const nameKey = normalizeKey(player.name);
      if (!nameKey) continue;
      const entry = stats.get(nameKey) ?? { name: player.name, count: 0, lastPlayedAt: 0 };
      entry.count += 1;
      entry.lastPlayedAt = Math.max(entry.lastPlayedAt, history.endedAt ?? 0);
      stats.set(nameKey, entry);
    }
  }

  await Promise.all(
    Array.from(stats.entries()).map(([nameKey, { name, count, lastPlayedAt }]) =>
      ManagerPlayer.findOneAndUpdate(
        { ownerUsername, nameKey },
        {
          $set: { tournamentsPlayed: count, lastPlayedAt },
          $setOnInsert: { ownerUsername, nameKey, name },
        },
        { upsert: true },
      ),
    ),
  );
}

// One-time-per-boot backfill so players from tournaments ended before this
// feature existed show up in the directory immediately. Safe to run on
// every boot — recomputePlayerStatsForOwner is a full recount, not an
// increment.
export async function backfillPlayerStatsFromHistory() {
  const owners = await TournamentHistory.distinct("ownerUsername");
  for (const owner of owners) {
    await recomputePlayerStatsForOwner(owner);
  }
}
