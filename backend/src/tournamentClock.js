import { defaultLevels } from "./levels.js";

const STATUS = {
  IDLE: "idle",
  RUNNING: "running",
  PAUSED: "paused",
};

// Server-authoritative tournament clock. Tracks a target end timestamp while
// running so elapsed time survives client refreshes/drift instead of being
// ticked down locally.
export class TournamentClock {
  constructor(levels = defaultLevels) {
    this.levels = levels;
    this.currentLevelIndex = 0;
    this.status = STATUS.IDLE;
    this.remainingMs = this.levels[0].durationSeconds * 1000;
    this.levelEndTimestamp = null;
  }

  get currentLevel() {
    return this.levels[this.currentLevelIndex];
  }

  get nextLevel() {
    return this.levels[this.currentLevelIndex + 1] ?? null;
  }

  start() {
    if (this.status === STATUS.RUNNING) return;
    this.levelEndTimestamp = Date.now() + this.remainingMs;
    this.status = STATUS.RUNNING;
  }

  pause() {
    if (this.status !== STATUS.RUNNING) return;
    this.remainingMs = Math.max(0, this.levelEndTimestamp - Date.now());
    this.levelEndTimestamp = null;
    this.status = STATUS.PAUSED;
  }

  reset() {
    this.status = STATUS.IDLE;
    this.levelEndTimestamp = null;
    this.remainingMs = this.currentLevel.durationSeconds * 1000;
  }

  skipLevel() {
    const wasRunning = this.status === STATUS.RUNNING;
    this.currentLevelIndex = Math.min(this.currentLevelIndex + 1, this.levels.length - 1);
    this.remainingMs = this.currentLevel.durationSeconds * 1000;
    this.levelEndTimestamp = wasRunning ? Date.now() + this.remainingMs : null;
    this.status = wasRunning ? STATUS.RUNNING : STATUS.IDLE;
  }

  previousLevel() {
    const wasRunning = this.status === STATUS.RUNNING;
    this.currentLevelIndex = Math.max(this.currentLevelIndex - 1, 0);
    this.remainingMs = this.currentLevel.durationSeconds * 1000;
    this.levelEndTimestamp = wasRunning ? Date.now() + this.remainingMs : null;
    this.status = wasRunning ? STATUS.RUNNING : STATUS.IDLE;
  }

  // Replaces the whole blind structure (used by the structure editor). Level
  // numbers are recomputed from array order rather than trusting the client.
  setLevels(levels) {
    if (this.status === STATUS.RUNNING) {
      throw new Error("Pause the clock before editing the structure");
    }
    if (!Array.isArray(levels) || levels.length === 0) {
      throw new Error("Structure must contain at least one level");
    }

    this.levels = levels.map((raw, index) => ({
      level: index + 1,
      smallBlind: Math.max(0, Number(raw.smallBlind) || 0),
      bigBlind: Math.max(0, Number(raw.bigBlind) || 0),
      ante: Math.max(0, Number(raw.ante) || 0),
      durationSeconds: Math.max(10, Number(raw.durationSeconds) || 60),
      isBreak: Boolean(raw.isBreak),
    }));
    this.currentLevelIndex = Math.min(this.currentLevelIndex, this.levels.length - 1);
    this.remainingMs = this.currentLevel.durationSeconds * 1000;
    this.levelEndTimestamp = null;
    this.status = STATUS.IDLE;
  }

  // Advances to the next level automatically when the clock runs out while running.
  _advanceOnExpiry() {
    const isLastLevel = this.currentLevelIndex >= this.levels.length - 1;
    if (isLastLevel) {
      this.status = STATUS.PAUSED;
      this.levelEndTimestamp = null;
      this.remainingMs = 0;
      return;
    }
    this.currentLevelIndex += 1;
    this.remainingMs = this.currentLevel.durationSeconds * 1000;
    this.levelEndTimestamp = Date.now() + this.remainingMs;
  }

  getRemainingMs() {
    if (this.status !== STATUS.RUNNING) return this.remainingMs;
    return Math.max(0, this.levelEndTimestamp - Date.now());
  }

  // Called on a server-side interval. Returns true if the broadcastable state changed.
  tick() {
    if (this.status !== STATUS.RUNNING) return false;
    if (this.levelEndTimestamp - Date.now() <= 0) {
      this._advanceOnExpiry();
    }
    return true;
  }

  getState() {
    return {
      status: this.status,
      currentLevelIndex: this.currentLevelIndex,
      currentLevel: this.currentLevel,
      nextLevel: this.nextLevel,
      remainingMs: this.getRemainingMs(),
      totalLevels: this.levels.length,
      levels: this.levels,
    };
  }
}
