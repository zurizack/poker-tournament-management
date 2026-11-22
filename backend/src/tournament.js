import { randomUUID } from "crypto";
import { TournamentClock } from "./tournamentClock.js";
import { cloneLevels, defaultLevels } from "./levels.js";
import { DEFAULT_PRIZE_CONFIG, DEFAULT_ENTRY_FEES, computePrizePool, assertValidPrizeConfig } from "./prizePool.js";

export class Tournament {
  constructor(id, ownerUsername) {
    this.id = id;
    this.ownerUsername = ownerUsername;
    this.createdAt = Date.now();
    this.clock = new TournamentClock(cloneLevels(defaultLevels));
    this.players = [];
    this._quickPlayerCounter = 0;
    this.startingStack = 1000;
    this.templateId = null;
    this.status = "active";
    this.admins = [];
    this.pendingAdmins = [];
    this.name = "";
    this.allowRebuys = true;
    this.rebuyLimitType = "unlimited";
    this.maxRebuysPerPlayer = null;
    this.allowAddOn = true;
    this.buyInAmount = DEFAULT_ENTRY_FEES.buyInAmount;
    this.rebuyAmount = DEFAULT_ENTRY_FEES.rebuyAmount;
    this.addOnAmount = DEFAULT_ENTRY_FEES.addOnAmount;
    this.prizeConfig = { ...DEFAULT_PRIZE_CONFIG };
    // Runtime audit trail — clock/admin interventions only (buy-ins/rebuys
    // are already captured in each player's totals, so logging them here
    // too would just duplicate that data as timeline noise). Archived
    // verbatim into TournamentHistory when the tournament ends.
    this.events = [];
    this.startedAt = null;
  }

  _logEvent(type, data = {}) {
    this.events.push({ type, timestamp: Date.now(), ...data });
  }

  // Clock control wrappers — index.js calls these instead of this.clock.*
  // directly so every intervention lands in the audit trail in one place.
  start() {
    const wasPaused = this.clock.status === "paused";
    this.clock.start();
    if (!this.startedAt) this.startedAt = Date.now();
    this._logEvent(wasPaused ? "resumed" : "started");
  }

  pause() {
    this.clock.pause();
    this._logEvent("paused");
  }

  reset() {
    this.clock.reset();
    this._logEvent("reset");
  }

  skipLevel() {
    const fromLevelIndex = this.clock.currentLevelIndex;
    this.clock.skipLevel();
    this._logEvent("level_skipped", { fromLevelIndex, toLevelIndex: this.clock.currentLevelIndex });
  }

  previousLevel() {
    const fromLevelIndex = this.clock.currentLevelIndex;
    this.clock.previousLevel();
    this._logEvent("level_reversed", { fromLevelIndex, toLevelIndex: this.clock.currentLevelIndex });
  }

  // Single permission check reused by every gameplay action and by end() —
  // owner or any accepted admin may manage the tournament. A pending
  // invitation grants no access until it's accepted.
  isManagedBy(username) {
    return username === this.ownerUsername || this.admins.includes(username);
  }

  // Owner grants access by email; this starts an invitation rather than
  // granting it outright — see acceptInvitation()/declineInvitation().
  inviteAdmin(username) {
    if (username === this.ownerUsername) {
      throw new Error("Owner is already a manager");
    }
    if (this.admins.includes(username)) {
      throw new Error("Already an admin");
    }
    if (this.pendingAdmins.includes(username)) {
      throw new Error("Already invited");
    }
    this.pendingAdmins.push(username);
  }

  acceptInvitation(username) {
    if (!this.pendingAdmins.includes(username)) {
      throw new Error("No pending invitation");
    }
    this.pendingAdmins = this.pendingAdmins.filter((admin) => admin !== username);
    this.admins.push(username);
  }

  // Idempotent — declining a non-existent invitation is a no-op, not an error.
  declineInvitation(username) {
    this.pendingAdmins = this.pendingAdmins.filter((admin) => admin !== username);
  }

  // Owner-only revoke — covers both an already-accepted admin and a
  // still-pending invitation, since from the owner's side "remove this
  // person" means the same thing either way. Idempotent either way too.
  removeAdmin(username) {
    this.admins = this.admins.filter((admin) => admin !== username);
    this.pendingAdmins = this.pendingAdmins.filter((admin) => admin !== username);
  }

  // Terminal — once ended, requireOwnedTournament() in index.js rejects
  // further manager actions and the tick loop/dashboard list stop
  // considering this tournament. Pausing first keeps the persisted clock
  // snapshot from looking like it's still counting down.
  end() {
    if (this.clock.status === "running") {
      this.clock.pause();
    }
    this.status = "ended";
    this._logEvent("tournament_ended");
  }

  // Chips granted per buy-in/rebuy/add-on, used to estimate the average
  // stack still in play. Same amount for every entry — home games rarely
  // vary this per player.
  setStartingStack(amount) {
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      throw new Error("Starting stack must be a positive number");
    }
    const previousValue = this.startingStack;
    this.startingStack = Math.round(value);
    if (this.startingStack !== previousValue) {
      this._logEvent("starting_stack_updated", { previousValue, newValue: this.startingStack });
    }
  }

  // Name is optional so a manager can seat a player with a single click
  // ("Quick Add") instead of typing a name every time. buyIns is always
  // exactly 1 and stays that way for the player's lifetime — there's no
  // recordBuyIn/undoBuyIn — any further entry/reload is a re-buy instead.
  addPlayer(name) {
    const trimmed = (name || "").trim();
    const finalName = trimmed || `Player ${++this._quickPlayerCounter}`;
    const player = {
      id: randomUUID(),
      name: finalName,
      status: "active",
      buyIns: 1,
      rebuys: 0,
      addOns: 0,
    };
    this.players.push(player);
    return player;
  }

  // Hard delete — only for correcting a mistaken add. Use eliminatePlayer()
  // to mark someone out of chips without losing their buy-in/rebuy history.
  removePlayer(playerId) {
    this.players = this.players.filter((player) => player.id !== playerId);
  }

  _findPlayer(playerId) {
    const player = this.players.find((p) => p.id === playerId);
    if (!player) {
      throw new Error("Player not found");
    }
    return player;
  }

  eliminatePlayer(playerId) {
    this._findPlayer(playerId).status = "eliminated";
  }

  reinstatePlayer(playerId) {
    this._findPlayer(playerId).status = "active";
  }

  _adjustCount(playerId, field, delta) {
    const player = this._findPlayer(playerId);
    player[field] = Math.max(0, player[field] + delta);
  }

  recordRebuy(playerId) {
    if (!this.allowRebuys) {
      throw new Error("Rebuys are not allowed for this tournament");
    }
    if (this.rebuyLimitType === "limited" && this._findPlayer(playerId).rebuys >= this.maxRebuysPerPlayer) {
      throw new Error("Rebuy limit reached");
    }
    this._adjustCount(playerId, "rebuys", 1);
  }

  // Always allowed, even past the limit — correcting a mistaken entry
  // shouldn't be blocked by the same limit that stopped it going up.
  undoRebuy(playerId) {
    this._adjustCount(playerId, "rebuys", -1);
  }

  recordAddOn(playerId) {
    if (!this.allowAddOn) {
      throw new Error("Add-ons are not allowed for this tournament");
    }
    this._adjustCount(playerId, "addOns", 1);
  }

  undoAddOn(playerId) {
    this._adjustCount(playerId, "addOns", -1);
  }

  updateStructure(levels) {
    const previousLevelCount = this.clock.levels.length;
    this.clock.setLevels(levels);
    this._logEvent("structure_updated", { previousLevelCount, newLevelCount: this.clock.levels.length });
  }

  // `updates` is already field-validated by prizePool.parsePrizeConfigFields
  // (see index.js) — this only merges it onto the live config and re-checks
  // cross-field integrity (the custom-percentages-sum-to-100 rule), since
  // that depends on the merged result, not any single field in isolation.
  updatePrizeConfig(updates) {
    const merged = { ...this.prizeConfig, ...updates };
    assertValidPrizeConfig(merged);
    const changed = JSON.stringify(merged) !== JSON.stringify(this.prizeConfig);
    this.prizeConfig = merged;
    if (changed) this._logEvent("prize_config_updated");
  }

  // Live-editable (unlike allowRebuys/rebuyLimitType, which are setup-only) —
  // a manager can set or correct the buy-in/re-buy/add-on dollar amounts at
  // any point during a running tournament, same as setStartingStack. This is
  // what actually makes the prize pool move: getState() always multiplies
  // these against the live entry/re-buy/add-on counts on every broadcast, so
  // there's nothing else to "trigger" — the next broadcast already reflects it.
  updateEntryFees(updates) {
    if (updates.buyInAmount !== undefined) this.buyInAmount = updates.buyInAmount;
    if (updates.rebuyAmount !== undefined) this.rebuyAmount = updates.rebuyAmount;
    if (updates.addOnAmount !== undefined) this.addOnAmount = updates.addOnAmount;
    if (Object.keys(updates).length > 0) this._logEvent("entry_fees_updated");
  }

  getState() {
    const totalBuyIns = this.players.reduce((sum, p) => sum + p.buyIns, 0);
    const totalRebuys = this.players.reduce((sum, p) => sum + p.rebuys, 0);
    const totalAddOns = this.players.reduce((sum, p) => sum + p.addOns, 0);
    const activePlayerCount = this.players.filter((p) => p.status === "active").length;
    const totalChips = (totalBuyIns + totalRebuys + totalAddOns) * this.startingStack;
    const totals = {
      playerCount: this.players.length,
      activePlayerCount,
      totalBuyIns,
      totalRebuys,
      totalAddOns,
      startingStack: this.startingStack,
      totalChips,
      averageStack: activePlayerCount > 0 ? Math.round(totalChips / activePlayerCount) : 0,
    };

    return {
      id: this.id,
      name: this.name,
      status: this.status,
      ownerUsername: this.ownerUsername,
      admins: [...this.admins],
      pendingAdmins: [...this.pendingAdmins],
      allowRebuys: this.allowRebuys,
      rebuyLimitType: this.rebuyLimitType,
      maxRebuysPerPlayer: this.maxRebuysPerPlayer,
      allowAddOn: this.allowAddOn,
      buyInAmount: this.buyInAmount,
      rebuyAmount: this.rebuyAmount,
      addOnAmount: this.addOnAmount,
      prizeConfig: { ...this.prizeConfig },
      clock: this.clock.getState(),
      players: this.players,
      totals,
      prize: computePrizePool({
        totals,
        entryFees: { buyInAmount: this.buyInAmount, rebuyAmount: this.rebuyAmount, addOnAmount: this.addOnAmount },
        prizeConfig: this.prizeConfig,
      }),
    };
  }

  toPersistableState() {
    return {
      _id: this.id,
      ownerUsername: this.ownerUsername,
      createdAt: this.createdAt,
      startingStack: this.startingStack,
      templateId: this.templateId,
      status: this.status,
      admins: [...this.admins],
      pendingAdmins: [...this.pendingAdmins],
      name: this.name,
      allowRebuys: this.allowRebuys,
      rebuyLimitType: this.rebuyLimitType,
      maxRebuysPerPlayer: this.maxRebuysPerPlayer,
      allowAddOn: this.allowAddOn,
      buyInAmount: this.buyInAmount,
      rebuyAmount: this.rebuyAmount,
      addOnAmount: this.addOnAmount,
      prizeConfig: { ...this.prizeConfig },
      quickPlayerCounter: this._quickPlayerCounter,
      clock: this.clock.toPersistableState(),
      players: this.players.map((player) => ({ ...player })),
      events: this.events.map((event) => ({ ...event })),
      startedAt: this.startedAt,
    };
  }

  static fromPersistedState(doc) {
    const tournament = new Tournament(doc._id, doc.ownerUsername);
    tournament.createdAt = doc.createdAt;
    tournament.startingStack = doc.startingStack;
    tournament.templateId = doc.templateId ?? null;
    tournament.status = doc.status ?? "active";
    tournament.admins = doc.admins ?? [];
    tournament.pendingAdmins = doc.pendingAdmins ?? [];
    tournament.name = doc.name ?? "";
    tournament.allowRebuys = doc.allowRebuys ?? true;
    tournament.rebuyLimitType = doc.rebuyLimitType ?? "unlimited";
    tournament.maxRebuysPerPlayer = doc.maxRebuysPerPlayer ?? null;
    tournament.allowAddOn = doc.allowAddOn ?? true;
    tournament.buyInAmount = doc.buyInAmount ?? DEFAULT_ENTRY_FEES.buyInAmount;
    tournament.rebuyAmount = doc.rebuyAmount ?? DEFAULT_ENTRY_FEES.rebuyAmount;
    tournament.addOnAmount = doc.addOnAmount ?? DEFAULT_ENTRY_FEES.addOnAmount;
    tournament.prizeConfig = { ...DEFAULT_PRIZE_CONFIG, ...(doc.prizeConfig ?? {}) };
    tournament._quickPlayerCounter = doc.quickPlayerCounter ?? 0;
    tournament.players = doc.players.map((player) => ({ ...player }));
    tournament.clock = TournamentClock.fromPersistedState(doc.clock);
    tournament.events = (doc.events ?? []).map((event) => ({ ...event }));
    tournament.startedAt = doc.startedAt ?? null;
    return tournament;
  }
}
