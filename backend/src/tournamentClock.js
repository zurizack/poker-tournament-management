import { defaultLevels, cloneLevels, normalizeLevels } from "./levels.js";

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
  // Safe to call while running or paused — never forces a pause/reset.
  // Preserves elapsed time in the current level: editing its own duration
  // shifts the remaining countdown by the same delta, while edits to other
  // levels have no live effect until the clock reaches them. If the array
  // shrank past the manager's position, that level is treated as fresh
  // (never-started) since it's no longer "the same" level they were playing.
  setLevels(levels) {
    const previousIndex = this.currentLevelIndex;
    const previousDurationMs = this.currentLevel.durationSeconds * 1000;
    const elapsedMs = this.status === STATUS.IDLE ? 0 : previousDurationMs - this.getRemainingMs();
    const wasRunning = this.status === STATUS.RUNNING;
    const wasPaused = this.status === STATUS.PAUSED;

    this.levels = normalizeLevels(levels);
    this.currentLevelIndex = Math.min(previousIndex, this.levels.length - 1);
    const samePosition = this.currentLevelIndex === previousIndex;

    const newDurationMs = this.currentLevel.durationSeconds * 1000;
    const preservedElapsedMs = samePosition ? Math.min(elapsedMs, newDurationMs) : 0;
    this.remainingMs = newDurationMs - preservedElapsedMs;

    if (wasRunning) {
      this.levelEndTimestamp = Date.now() + this.remainingMs;
      this.status = STATUS.RUNNING;
    } else {
      this.levelEndTimestamp = null;
      this.status = wasPaused ? STATUS.PAUSED : STATUS.IDLE;
    }
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

  // Called on a server-side interval. `broadcast` is true every second while
  // running (clients still need the recomputed countdown); `persist` is true
  // only when a level actually advanced/expired — a real state mutation, not
  // just the passage of time — so the caller only writes to Mongo then.
  tick() {
    if (this.status !== STATUS.RUNNING) return { broadcast: false, persist: false };
    let advanced = false;
    if (this.levelEndTimestamp - Date.now() <= 0) {
      this._advanceOnExpiry();
      advanced = true;
    }
    return { broadcast: true, persist: advanced };
  }

  // Replays expiry transitions after a cold rehydrate (server restart) so an
  // absolute levelEndTimestamp observed far in the past catches up to "now" —
  // the same effect as tick() having fired once per second the whole time
  // the process was down. Idle/paused clocks skip the loop entirely since
  // their remainingMs snapshot is already time-independent. Terminates
  // because each iteration either advances currentLevelIndex (bounded by
  // levels.length) or flips status to "paused" inside _advanceOnExpiry.
  catchUp() {
    let advanced = false;
    while (
      this.status === STATUS.RUNNING &&
      this.levelEndTimestamp !== null &&
      this.levelEndTimestamp - Date.now() <= 0
    ) {
      this._advanceOnExpiry();
      advanced = true;
    }
    return advanced;
  }

  toPersistableState() {
    return {
      status: this.status,
      currentLevelIndex: this.currentLevelIndex,
      remainingMs: this.remainingMs,
      levelEndTimestamp: this.levelEndTimestamp,
      levels: cloneLevels(this.levels),
    };
  }

  static fromPersistedState(state) {
    const clock = new TournamentClock(cloneLevels(state.levels));
    clock.currentLevelIndex = state.currentLevelIndex;
    clock.status = state.status;
    clock.remainingMs = state.remainingMs;
    clock.levelEndTimestamp = state.levelEndTimestamp;
    return clock;
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
