import { randomUUID } from "crypto";
import { TournamentClock } from "./tournamentClock.js";
import { cloneLevels, defaultLevels } from "./levels.js";

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
  }

  // Chips granted per buy-in/rebuy/add-on, used to estimate the average
  // stack still in play. Same amount for every entry — home games rarely
  // vary this per player.
  setStartingStack(amount) {
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      throw new Error("Starting stack must be a positive number");
    }
    this.startingStack = Math.round(value);
  }

  // Name is optional so a manager can seat a player with a single click
  // ("Quick Add") instead of typing a name every time.
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

  recordBuyIn(playerId) {
    this._adjustCount(playerId, "buyIns", 1);
  }

  undoBuyIn(playerId) {
    this._adjustCount(playerId, "buyIns", -1);
  }

  recordRebuy(playerId) {
    this._adjustCount(playerId, "rebuys", 1);
  }

  undoRebuy(playerId) {
    this._adjustCount(playerId, "rebuys", -1);
  }

  recordAddOn(playerId) {
    this._adjustCount(playerId, "addOns", 1);
  }

  undoAddOn(playerId) {
    this._adjustCount(playerId, "addOns", -1);
  }

  updateStructure(levels) {
    this.clock.setLevels(levels);
  }

  getState() {
    const totalBuyIns = this.players.reduce((sum, p) => sum + p.buyIns, 0);
    const totalRebuys = this.players.reduce((sum, p) => sum + p.rebuys, 0);
    const totalAddOns = this.players.reduce((sum, p) => sum + p.addOns, 0);
    const activePlayerCount = this.players.filter((p) => p.status === "active").length;
    const totalChips = (totalBuyIns + totalRebuys + totalAddOns) * this.startingStack;

    return {
      id: this.id,
      status: this.status,
      ownerUsername: this.ownerUsername,
      admins: [...this.admins],
      pendingAdmins: [...this.pendingAdmins],
      clock: this.clock.getState(),
      players: this.players,
      totals: {
        playerCount: this.players.length,
        activePlayerCount,
        totalBuyIns,
        totalRebuys,
        totalAddOns,
        startingStack: this.startingStack,
        totalChips,
        averageStack: activePlayerCount > 0 ? Math.round(totalChips / activePlayerCount) : 0,
      },
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
      quickPlayerCounter: this._quickPlayerCounter,
      clock: this.clock.toPersistableState(),
      players: this.players.map((player) => ({ ...player })),
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
    tournament._quickPlayerCounter = doc.quickPlayerCounter ?? 0;
    tournament.players = doc.players.map((player) => ({ ...player }));
    tournament.clock = TournamentClock.fromPersistedState(doc.clock);
    return tournament;
  }
}
