import { useLanguage } from "../context/LanguageContext";
import { formatChips, formatClock } from "../utils/format";

function BlindPair({ currentLevel, compact }) {
  const { t, locale } = useLanguage();

  if (currentLevel.isBreak) {
    return (
      <div
        className={`font-bold uppercase tracking-wide text-amber-400 ${
          compact ? "text-4xl" : "text-[clamp(2.5rem,13vw,6rem)]"
        }`}
      >
        {t("clock.break")}
      </div>
    );
  }

  return (
    // dir="ltr" pinned: small/big blind order is numeric data, not prose —
    // a flex row's child order reverses under the page's RTL direction,
    // which would otherwise visually swap small and big blind on screen.
    <div
      dir="ltr"
      className={`flex items-baseline justify-center ${compact ? "gap-3" : "gap-3 sm:gap-6 md:gap-10"}`}
    >
      <span
        className={`font-bold tabular-nums text-white ${compact ? "text-4xl" : "text-[clamp(2.5rem,13vw,6rem)]"}`}
      >
        {formatChips(currentLevel.smallBlind, locale)}
      </span>
      <span className={`font-light text-slate-500 ${compact ? "text-2xl" : "text-[clamp(1.5rem,7vw,3.5rem)]"}`}>
        /
      </span>
      <span
        className={`font-bold tabular-nums text-white ${compact ? "text-4xl" : "text-[clamp(2.5rem,13vw,6rem)]"}`}
      >
        {formatChips(currentLevel.bigBlind, locale)}
      </span>
    </div>
  );
}

function NextLevelPreview({ nextLevel }) {
  const { t, locale } = useLanguage();

  if (!nextLevel) {
    return <span className="text-slate-400">{t("clock.finalLevel")}</span>;
  }

  if (nextLevel.isBreak) {
    return <span className="text-amber-400">{t("clock.break")}</span>;
  }

  return (
    <span className="text-slate-200">
      {formatChips(nextLevel.smallBlind, locale)} / {formatChips(nextLevel.bigBlind, locale)}
      {nextLevel.ante > 0 && (
        <span className="text-slate-400"> ({t("clock.ante").toLowerCase()} {formatChips(nextLevel.ante, locale)})</span>
      )}
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
  const { t, locale } = useLanguage();
  const { status, currentLevel, nextLevel, remainingMs, totalLevels } = clockState;
  const isPaused = status === "paused";

  return (
    <div
      className={`flex w-full flex-1 flex-col items-center justify-center overflow-hidden bg-slate-950 text-center ${
        compact ? "gap-3 px-4 py-6" : "gap-5 px-3 py-6 sm:gap-8 sm:px-6 sm:py-10"
      }`}
    >
      <div className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400 sm:text-lg md:text-xl">
        {t("clock.level")} {currentLevel.level} <span className="text-slate-600">/ {totalLevels}</span>
      </div>

      <BlindPair currentLevel={currentLevel} compact={compact} />

      {!currentLevel.isBreak && currentLevel.ante > 0 && (
        <div className={`font-medium text-slate-400 ${compact ? "text-lg" : "text-[clamp(1.1rem,4vw,1.75rem)]"}`}>
          {t("clock.ante")} <span className="text-slate-200">{formatChips(currentLevel.ante, locale)}</span>
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
        <div className="text-base font-semibold uppercase tracking-widest text-slate-500 sm:text-xl">
          {t("clock.paused")}
        </div>
      )}

      <div className="text-base text-slate-400 sm:text-xl">
        {t("clock.next")} <NextLevelPreview nextLevel={nextLevel} />
      </div>

      {totals && (
        <div className="grid w-full max-w-md grid-cols-2 gap-3 text-sm text-slate-400 sm:flex sm:max-w-none sm:flex-wrap sm:justify-center sm:gap-8 sm:text-lg">
          <div className="rounded-lg bg-slate-900/60 py-2 sm:bg-transparent sm:py-0">
            {t("clock.players")}{" "}
            <span className="font-semibold text-slate-100">
              {totals.activePlayerCount}/{totals.playerCount}
            </span>
          </div>
          <div className="rounded-lg bg-slate-900/60 py-2 sm:bg-transparent sm:py-0">
            {t("clock.avgStack")}{" "}
            <span className="font-semibold text-slate-100">{formatChips(totals.averageStack, locale)}</span>
          </div>
          <div className="rounded-lg bg-slate-900/60 py-2 sm:bg-transparent sm:py-0">
            {t("clock.rebuys")} <span className="font-semibold text-slate-100">{totals.totalRebuys}</span>
          </div>
          <div className="rounded-lg bg-slate-900/60 py-2 sm:bg-transparent sm:py-0">
            {t("clock.addOns")} <span className="font-semibold text-slate-100">{totals.totalAddOns}</span>
          </div>
        </div>
      )}
    </div>
  );
}
