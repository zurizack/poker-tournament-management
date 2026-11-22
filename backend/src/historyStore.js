import { TournamentHistory } from "./models/TournamentHistory.js";
import { cloneLevels } from "./levels.js";
import { computePrizePool } from "./prizePool.js";

// Pairs each "paused" event with the next "resumed" (or, if the tournament
// was paused when it ended, "tournament_ended") event to attach how long
// that pause lasted. Computed once here, at archive time, rather than
// tracked live — the live Tournament only needs to know *that* it paused.
function withPauseDurations(events) {
  const result = events.map((event) => ({ ...event }));
  for (let i = 0; i < result.length; i++) {
    if (result[i].type !== "paused") continue;
    const next = result.slice(i + 1).find((e) => e.type === "resumed" || e.type === "tournament_ended");
    if (next) {
      result[i].durationMs = next.timestamp - result[i].timestamp;
    }
  }
  return result;
}

export function buildHistorySnapshot(tournament) {
  const totalEntries = tournament.players.reduce((sum, p) => sum + p.buyIns, 0);
  const totalRebuys = tournament.players.reduce((sum, p) => sum + p.rebuys, 0);
  const totalAddOns = tournament.players.reduce((sum, p) => sum + p.addOns, 0);

  const events = withPauseDurations(tournament.events);
  const endedAt = events.find((e) => e.type === "tournament_ended")?.timestamp ?? Date.now();
  const startedAt = tournament.startedAt ?? tournament.createdAt;
  const grossDurationMs = Math.max(0, endedAt - startedAt);
  const pausedMs = events
    .filter((e) => e.type === "paused" && e.durationMs)
    .reduce((sum, e) => sum + e.durationMs, 0);

  const { totalPrizePool, payouts } = computePrizePool({
    totals: { totalBuyIns: totalEntries, totalRebuys, totalAddOns },
    entryFees: {
      buyInAmount: tournament.buyInAmount,
      rebuyAmount: tournament.rebuyAmount,
      addOnAmount: tournament.addOnAmount,
    },
    prizeConfig: tournament.prizeConfig,
  });

  return {
    tournamentId: tournament.id,
    ownerUsername: tournament.ownerUsername,
    admins: [...tournament.admins],
    name: tournament.name,
    startingStack: tournament.startingStack,
    levels: cloneLevels(tournament.clock.levels),
    allowRebuys: tournament.allowRebuys,
    rebuyLimitType: tournament.rebuyLimitType,
    maxRebuysPerPlayer: tournament.maxRebuysPerPlayer,
    allowAddOn: tournament.allowAddOn,
    buyInAmount: tournament.buyInAmount,
    rebuyAmount: tournament.rebuyAmount,
    addOnAmount: tournament.addOnAmount,
    prizeConfig: { ...tournament.prizeConfig },
    finalPrizePool: totalPrizePool,
    finalPayouts: payouts,
    startedAt,
    endedAt,
    grossDurationMs,
    activeDurationMs: Math.max(0, grossDurationMs - pausedMs),
    totalEntries,
    uniquePlayers: tournament.players.length,
    totalRebuys,
    totalAddOns,
    finalLevelIndex: tournament.clock.currentLevelIndex,
    finalLevel: { ...tournament.clock.currentLevel },
    players: tournament.players.map((player) => ({ ...player })),
    events,
  };
}

export async function createHistory(tournament) {
  return TournamentHistory.create(buildHistorySnapshot(tournament));
}

// A manager sees history for any tournament they either own or co-admin —
// same access rule as the live owned/managed tournament lists.
export function listHistoryForUser(username, { tournamentId } = {}) {
  const filter = { $or: [{ ownerUsername: username }, { admins: username }] };
  if (tournamentId) filter.tournamentId = tournamentId;
  return TournamentHistory.find(filter).sort({ endedAt: -1 }).lean();
}

export async function getHistoryById(id, username) {
  try {
    return await TournamentHistory.findOne({
      _id: id,
      $or: [{ ownerUsername: username }, { admins: username }],
    }).lean();
  } catch {
    return null; // malformed ObjectId -> treat as not-found, not a 500
  }
}
