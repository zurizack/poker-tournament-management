// Prize pool & payout math — the single source of truth consumed by
// Tournament.getState() (live broadcasts) and historyStore (end-of-run
// snapshot). Deliberately has no Mongo/Express dependency so it stays a
// pure, easily-testable module; index.js is the only caller that touches
// HTTP/validation errors.

// Payout structure only — buy-in/re-buy/add-on amounts live on the
// tournament's core data (same place as startingStack/allowRebuys) since
// they describe the tournament itself, not how its pool gets paid out. See
// DEFAULT_ENTRY_FEES below for that half of the calculation. There is no
// manual total-pool override — the pool is always the automatic calculation,
// by design (see the "Prize Pool & Payouts" plan: relying solely on actual
// entries/re-buys/add-ons keeps the number honest as the field changes).
export const DEFAULT_PRIZE_CONFIG = Object.freeze({
  itmMode: "percentage",
  itmPercent: 15,
  itmFixedPlaces: 3,
  payoutMode: "formula",
  customPayouts: [],
});

// Per-entry dollar amounts — set once at setup/template time alongside the
// other core tournament fields, read here only to compute the live pool.
// customRebuyPricesEnabled/rebuyPricesByIndex/rebuyCutoffLevel are the re-buy
// rule extensions: a per-index override of the flat rebuyAmount, and the
// last level re-buys are still allowed through (null = no cutoff).
export const DEFAULT_ENTRY_FEES = Object.freeze({
  buyInAmount: 0,
  rebuyAmount: 0,
  addOnAmount: 0,
  customRebuyPricesEnabled: false,
  rebuyPricesByIndex: [],
  rebuyCutoffLevel: null,
});

// These three field counts are small, fixed, real-world standard home-game
// numbers (not derived from the general formula below) — see plan: 1 spot
// takes it all, heads-up splits 65/35, three-handed 50/30/20.
const HARDCODED_PAYOUTS = {
  1: [100],
  2: [65, 35],
  3: [50, 30, 20],
};

// Standard largest-remainder apportionment: floor every raw share, then
// hand the leftover whole points (100 - sum of floors) one at a time to
// the places with the biggest fractional remainder, so the row always
// sums to exactly 100 with no single place absorbing all the rounding error.
function largestRemainderRound(rawPercentages) {
  const floors = rawPercentages.map((p) => Math.floor(p));
  const remainder = 100 - floors.reduce((sum, v) => sum + v, 0);
  const byFraction = rawPercentages
    .map((p, index) => ({ index, fraction: p - Math.floor(p) }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index);

  const result = [...floors];
  for (let k = 0; k < remainder; k++) {
    result[byFraction[k].index] += 1;
  }
  return result;
}

// The "Site Formula" curve: for n >= 4, place i (1-indexed) gets a weight
// of (n - i + 1) — a simple linear top-heavy taper — normalized to 100 and
// rounded via largestRemainderRound. n <= 3 uses the fixed table above.
export function generateFormulaPayouts(n) {
  if (!Number.isInteger(n) || n <= 0) return [];
  if (HARDCODED_PAYOUTS[n]) return [...HARDCODED_PAYOUTS[n]];

  const weights = Array.from({ length: n }, (_, i) => n - i);
  const weightSum = weights.reduce((sum, w) => sum + w, 0);
  const raw = weights.map((w) => (100 * w) / weightSum);
  return largestRemainderRound(raw);
}

// Percentage mode: Math.round(totalEntries * pct/100), floored at 1 place
// (never zero paid places once there's at least one entry) and capped at
// totalEntries (never more paid places than there are entries). Fixed mode:
// the manager's exact number, same floor/cap applied for live safety.
export function computePaidPlaces(totalEntries, { itmMode, itmPercent, itmFixedPlaces }) {
  if (!totalEntries || totalEntries <= 0) return 0;
  const requested =
    itmMode === "fixed" ? Math.floor(itmFixedPlaces) : Math.round(totalEntries * (itmPercent / 100));
  return Math.max(1, Math.min(totalEntries, requested));
}

// Custom mode pads/truncates the manager's saved array to the *current*
// paidPlaces length without mutating what they've already typed for the
// places that still exist: missing trailing slots default to 0, extra
// trailing slots are simply not included in the output.
export function resolvePayoutPercentages({ payoutMode, customPayouts, paidPlaces }) {
  if (paidPlaces <= 0) return [];
  if (payoutMode === "custom") {
    return Array.from({ length: paidPlaces }, (_, i) => Number(customPayouts?.[i]) || 0);
  }
  return generateFormulaPayouts(paidPlaces);
}

// Price of a player's Nth re-buy (1-indexed): the custom per-index price
// when enabled and that slot is actually defined, else the flat rebuyAmount
// fallback — so a partially-filled rebuyPricesByIndex (e.g. only re-buy #1
// customized) still prices the rest at the standard rate.
export function rebuyPriceForIndex(rebuyNumber, fees) {
  if (fees.customRebuyPricesEnabled) {
    const custom = fees.rebuyPricesByIndex?.[rebuyNumber - 1];
    if (custom !== undefined && custom !== null && Number.isFinite(Number(custom))) {
      return Number(custom);
    }
  }
  return fees.rebuyAmount;
}

// Summed per player (not totalRebuys * rebuyAmount) because once per-index
// pricing is enabled, two players with the same re-buy *count* can owe
// different amounts depending on which indices they each hit.
export function totalRebuyMoney(players, fees) {
  let sum = 0;
  for (const player of players) {
    for (let i = 1; i <= (player.rebuys || 0); i++) {
      sum += rebuyPriceForIndex(i, fees);
    }
  }
  return sum;
}

// `totals` is the same { totalBuyIns, totalRebuys, totalAddOns } shape
// Tournament.getState() already computes — "total entries" for ITM purposes
// is totalBuyIns (re-buys/add-ons add money, not new entries into the field).
// `entryFees` is the tournament's own { buyInAmount, rebuyAmount, addOnAmount,
// ... } (core data, not part of prizeConfig) — the live pool is always this
// automatic calculation, with no manual override. `players` (each with a
// `.rebuys` count) is needed to apply per-index re-buy pricing correctly.
export function computePrizePool({ totals, entryFees, prizeConfig, players = [] }) {
  const config = { ...DEFAULT_PRIZE_CONFIG, ...prizeConfig };
  const fees = { ...DEFAULT_ENTRY_FEES, ...entryFees };
  const totalEntries = totals.totalBuyIns;

  const totalPrizePool =
    totals.totalBuyIns * fees.buyInAmount + totalRebuyMoney(players, fees) + totals.totalAddOns * fees.addOnAmount;

  const paidPlaces = computePaidPlaces(totalEntries, config);
  const percentages = resolvePayoutPercentages({
    payoutMode: config.payoutMode,
    customPayouts: config.customPayouts,
    paidPlaces,
  });

  const payouts = percentages.map((percent, index) => ({
    place: index + 1,
    percent,
    amount: Math.round((totalPrizePool * percent) / 100),
  }));

  return { totalPrizePool, paidPlaces, payouts };
}

function nonNegativeNumber(value, label) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) {
    throw new Error(`${label} must be a non-negative number`);
  }
  return n;
}

// Parses/coerces whatever subset of { buyInAmount, rebuyAmount, addOnAmount,
// customRebuyPricesEnabled, rebuyPricesByIndex, rebuyCutoffLevel } appear in
// `body` — these are core tournament fields (same partial-update contract as
// parseRebuyRules), not part of prizeConfig. Shared by both the create/update
// HTTP routes and the live manager:updateEntryFees socket action.
export function parseEntryFeeFields(body) {
  const { buyInAmount, rebuyAmount, addOnAmount, customRebuyPricesEnabled, rebuyPricesByIndex, rebuyCutoffLevel } =
    body || {};
  const updates = {};
  if (buyInAmount !== undefined) updates.buyInAmount = nonNegativeNumber(buyInAmount, "Buy-in amount");
  if (rebuyAmount !== undefined) updates.rebuyAmount = nonNegativeNumber(rebuyAmount, "Re-buy amount");
  if (addOnAmount !== undefined) updates.addOnAmount = nonNegativeNumber(addOnAmount, "Add-on amount");

  if (customRebuyPricesEnabled !== undefined) {
    updates.customRebuyPricesEnabled = Boolean(customRebuyPricesEnabled);
  }
  if (rebuyPricesByIndex !== undefined) {
    if (
      !Array.isArray(rebuyPricesByIndex) ||
      rebuyPricesByIndex.some((p) => !Number.isFinite(Number(p)) || Number(p) < 0)
    ) {
      throw new Error("rebuyPricesByIndex must be an array of non-negative numbers");
    }
    updates.rebuyPricesByIndex = rebuyPricesByIndex.map((p) => Number(p));
  }
  if (rebuyCutoffLevel !== undefined) {
    if (rebuyCutoffLevel === null) {
      updates.rebuyCutoffLevel = null;
    } else {
      const n = Number(rebuyCutoffLevel);
      if (!Number.isInteger(n) || n < 1) {
        throw new Error("rebuyCutoffLevel must be a positive integer or null");
      }
      updates.rebuyCutoffLevel = n;
    }
  }

  return updates;
}

// Parses/coerces whatever subset of prizeConfig fields appear in `body`,
// returning only those fields — same "only touch what's present" partial-
// update contract as parseRebuyRules in index.js. Throws a plain Error on
// invalid input; callers turn that into an HTTP 400.
export function parsePrizeConfigFields(body) {
  const { itmMode, itmPercent, itmFixedPlaces, payoutMode, customPayouts } = body || {};

  const updates = {};

  if (itmMode !== undefined) {
    if (!["percentage", "fixed"].includes(itmMode)) {
      throw new Error("itmMode must be 'percentage' or 'fixed'");
    }
    updates.itmMode = itmMode;
  }

  if (itmPercent !== undefined) {
    const n = Number(itmPercent);
    if (!Number.isFinite(n) || n <= 0 || n > 100) {
      throw new Error("itmPercent must be a number between 1 and 100");
    }
    updates.itmPercent = n;
  }

  if (itmFixedPlaces !== undefined) {
    const n = Number(itmFixedPlaces);
    if (!Number.isInteger(n) || n < 1) {
      throw new Error("itmFixedPlaces must be a positive integer");
    }
    updates.itmFixedPlaces = n;
  }

  if (payoutMode !== undefined) {
    if (!["formula", "custom"].includes(payoutMode)) {
      throw new Error("payoutMode must be 'formula' or 'custom'");
    }
    updates.payoutMode = payoutMode;
  }

  if (customPayouts !== undefined) {
    if (!Array.isArray(customPayouts) || customPayouts.some((p) => !Number.isFinite(Number(p)) || Number(p) < 0)) {
      throw new Error("customPayouts must be an array of non-negative numbers");
    }
    updates.customPayouts = customPayouts.map((p) => Number(p));
  }

  return updates;
}

// Cross-field integrity check run against the *merged* config (previous +
// updates) right before persisting — the live "Total: X%" indicator in the
// UI is just early feedback before the manager hits Save; this is the real
// gate. Only enforced once the manager has actually entered percentages
// (an empty array mid-setup is a valid, not-yet-finished state).
export function assertValidPrizeConfig(config) {
  if (config.payoutMode === "custom" && config.customPayouts.length > 0) {
    const sum = config.customPayouts.reduce((sum, p) => sum + Number(p), 0);
    if (Math.abs(sum - 100) > 0.01) {
      throw new Error(`Custom payout percentages must sum to 100% (currently ${sum}%)`);
    }
  }
}
