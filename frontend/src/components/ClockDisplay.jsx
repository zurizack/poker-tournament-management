import { formatChips, formatClock } from "../utils/format";

function BlindPair({ currentLevel, compact }) {
  if (currentLevel.isBreak) {
    return (
      <div
        className={`font-bold tracking-wide text-amber-400 ${
          compact ? "text-4xl" : "text-[clamp(2.5rem,13vw,6rem)]"
        }`}
      >
        BREAK
      </div>
    );
  }

  return (
    <div className={`flex items-baseline justify-center ${compact ? "gap-3" : "gap-3 sm:gap-6 md:gap-10"}`}>
      <span
        className={`font-bold tabular-nums text-white ${compact ? "text-4xl" : "text-[clamp(2.5rem,13vw,6rem)]"}`}
      >
        {formatChips(currentLevel.smallBlind)}
      </span>
      <span className={`font-light text-slate-500 ${compact ? "text-2xl" : "text-[clamp(1.5rem,7vw,3.5rem)]"}`}>
        /
      </span>
      <span
        className={`font-bold tabular-nums text-white ${compact ? "text-4xl" : "text-[clamp(2.5rem,13vw,6rem)]"}`}
      >
        {formatChips(currentLevel.bigBlind)}
      </span>
    </div>
  );
}

function NextLevelPreview({ nextLevel }) {
  if (!nextLevel) {
    return <span className="text-slate-400">Final level</span>;
  }

  if (nextLevel.isBreak) {
    return <span className="text-amber-400">Break</span>;
  }

  return (
    <span className="text-slate-200">
      {formatChips(nextLevel.smallBlind)} / {formatChips(nextLevel.bigBlind)}
      {nextLevel.ante > 0 && <span className="text-slate-400"> (ante {formatChips(nextLevel.ante)})</span>}
    </span>
  );
}

// `clockState` is the clock sub-object from a tournament snapshot
// ({ status, currentLevel, nextLevel, remainingMs, totalLevels }).
// `totals` (playerCount, totalRebuys, totalAddOns, averageStack, ...) is
// optional — pass it on the player view; omit it for a compact manager-side
// preview. Font sizes use clamp() so the display scales smoothly between a
// phone held at arm's length and a desktop monitor, rather than jumping at
// fixed breakpoints.
export function ClockDisplay({ clockState, totals, compact = false }) {
  const { status, currentLevel, nextLevel, remainingMs, totalLevels } = clockState;
  const isPaused = status === "paused";

  return (
    <div
      className={`flex w-full flex-1 flex-col items-center justify-center overflow-hidden bg-slate-950 text-center ${
        compact ? "gap-3 px-4 py-6" : "gap-5 px-3 py-6 sm:gap-8 sm:px-6 sm:py-10"
      }`}
    >
      <div className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400 sm:text-lg md:text-xl">
        Level {currentLevel.level} <span className="text-slate-600">/ {totalLevels}</span>
      </div>

      <BlindPair currentLevel={currentLevel} compact={compact} />

      {!currentLevel.isBreak && currentLevel.ante > 0 && (
        <div className={`font-medium text-slate-400 ${compact ? "text-lg" : "text-[clamp(1.1rem,4vw,1.75rem)]"}`}>
          Ante <span className="text-slate-200">{formatChips(currentLevel.ante)}</span>
        </div>
      )}

      <div
        className={`font-mono font-extrabold tabular-nums ${
          compact ? "text-6xl" : "text-[clamp(4rem,24vw,10rem)]"
        } ${isPaused ? "text-slate-500" : "text-emerald-400"}`}
      >
        {formatClock(remainingMs)}
      </div>

      {isPaused && (
        <div className="text-base font-semibold uppercase tracking-widest text-slate-500 sm:text-xl">Paused</div>
      )}

      <div className="text-base text-slate-400 sm:text-xl">
        Next: <NextLevelPreview nextLevel={nextLevel} />
      </div>

      {totals && (
        <div className="grid w-full max-w-md grid-cols-2 gap-3 text-sm text-slate-400 sm:flex sm:max-w-none sm:flex-wrap sm:justify-center sm:gap-8 sm:text-lg">
          <div className="rounded-lg bg-slate-900/60 py-2 sm:bg-transparent sm:py-0">
            Players{" "}
            <span className="font-semibold text-slate-100">
              {totals.activePlayerCount}/{totals.playerCount}
            </span>
          </div>
          <div className="rounded-lg bg-slate-900/60 py-2 sm:bg-transparent sm:py-0">
            Avg Stack <span className="font-semibold text-slate-100">{formatChips(totals.averageStack)}</span>
          </div>
          <div className="rounded-lg bg-slate-900/60 py-2 sm:bg-transparent sm:py-0">
            Rebuys <span className="font-semibold text-slate-100">{totals.totalRebuys}</span>
          </div>
          <div className="rounded-lg bg-slate-900/60 py-2 sm:bg-transparent sm:py-0">
            Add-ons <span className="font-semibold text-slate-100">{totals.totalAddOns}</span>
          </div>
        </div>
      )}
    </div>
  );
}
