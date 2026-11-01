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
}
