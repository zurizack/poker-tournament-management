import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useLanguage } from "../../context/LanguageContext";
import { api } from "../../lib/api";
import { LevelsEditor } from "../../components/LevelsEditor";
import { MirroredGlyph } from "../../components/MirroredGlyph";
import { LanguageToggle } from "../../components/LanguageToggle";
import { formatDuration, formatDateTime, formatChips } from "../../utils/format";

// Maps a raw event.type (snake_case, as stored) to its translation key
// (camelCase, under history.detail.events) — see backend tournament.js's
// _logEvent for the full set of types this can see.
const EVENT_LABEL_KEYS = {
  started: "started",
  resumed: "resumed",
  paused: "paused",
  reset: "reset",
  level_skipped: "levelSkipped",
  level_reversed: "levelReversed",
  structure_updated: "structureUpdated",
  starting_stack_updated: "stackUpdated",
  tournament_ended: "ended",
};

function describeEvent(event, t, locale) {
  switch (event.type) {
    case "paused":
      return event.durationMs
        ? t("history.detail.events.pausedFor", { duration: formatDuration(event.durationMs, t) })
        : null;
    case "level_skipped":
      return t("history.detail.events.skippedDetail", {
        from: event.fromLevelIndex + 1,
        to: event.toLevelIndex + 1,
      });
    case "level_reversed":
      return t("history.detail.events.reversedDetail", {
        from: event.fromLevelIndex + 1,
        to: event.toLevelIndex + 1,
      });
    case "structure_updated":
      return t("history.detail.events.structureDetail", {
        from: event.previousLevelCount,
        to: event.newLevelCount,
      });
    case "starting_stack_updated":
      return t("history.detail.events.stackDetail", {
        from: formatChips(event.previousValue, locale),
        to: formatChips(event.newValue, locale),
      });
    default:
      return null;
  }
}

function StatCard({ label, value }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900 px-4 py-3">
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-xl font-bold text-slate-100">{value}</div>
    </div>
  );
}

function Timeline({ events }) {
  const { t, locale } = useLanguage();

  if (events.length === 0) {
    return <p className="text-sm text-slate-500">{t("history.detail.noEvents")}</p>;
  }
  return (
    <ol className="flex flex-col gap-3">
      {events.map((event, index) => {
        const labelKey = EVENT_LABEL_KEYS[event.type];
        const detail = describeEvent(event, t, locale);
        return (
          <li key={index} className="flex gap-3 border-s-2 border-slate-800 ps-4">
            <div className="flex-1">
              <div className="text-sm font-semibold text-slate-200">
                {labelKey ? t(`history.detail.events.${labelKey}`) : event.type}
              </div>
              {detail && <div className="text-sm text-slate-400">{detail}</div>}
              <div className="text-xs text-slate-500">{formatDateTime(event.timestamp, locale)}</div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function HistoryDetailPage() {
  const { historyId } = useParams();
  const { token } = useAuth();
  const { t, locale } = useLanguage();
  const [history, setHistory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api
      .getHistory(token, historyId)
      .then(setHistory)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [historyId, token]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950 text-xl text-slate-500">
        {t("common.loading")}
      </div>
    );
  }

  if (error || !history) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-2 bg-slate-950 px-4 text-center text-slate-100">
        <p className="text-xl font-semibold text-red-400">{error || t("history.detail.notFound")}</p>
        <Link to="/manager/history" className="text-slate-400 hover:text-slate-200">
          <MirroredGlyph>←</MirroredGlyph> {t("nav.history")}
        </Link>
      </div>
    );
  }

  const events = [...history.events].sort((a, b) => a.timestamp - b.timestamp);

  return (
    <div className="min-h-screen bg-slate-950 px-6 py-10 text-slate-100">
      <div className="mx-auto max-w-3xl">
        <Link to="/manager/history" className="text-sm text-slate-500 hover:text-slate-300">
          <MirroredGlyph>←</MirroredGlyph> {t("nav.history")}
        </Link>
        <div className="mb-6 mt-2 flex items-center justify-between gap-3">
          <h1 className="text-2xl font-bold">{history.name || t("common.unnamedTournament")}</h1>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-slate-800 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-slate-400">
              {t("history.detail.readOnlyBadge")}
            </span>
            <LanguageToggle />
          </div>
        </div>
        <p className="mb-6 text-sm text-slate-500">
          {formatDateTime(history.startedAt, locale)} — {formatDateTime(history.endedAt, locale)}
        </p>

        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label={t("history.detail.duration")} value={formatDuration(history.activeDurationMs, t)} />
          <StatCard label={t("history.detail.entries")} value={history.totalEntries} />
          <StatCard label={t("history.detail.rebuysLabel")} value={history.totalRebuys} />
          <StatCard label={t("live.addOnsLabel")} value={history.totalAddOns} />
          <StatCard label={t("nav.players")} value={history.uniquePlayers} />
          <StatCard label={t("history.detail.finalLevelLabel")} value={history.finalLevelIndex + 1} />
          <StatCard
            label={t("setup.startingStackLabel")}
            value={formatChips(history.startingStack, locale)}
          />
          <StatCard
            label={t("history.detail.grossDuration")}
            value={formatDuration(history.grossDurationMs, t)}
          />
        </div>

        <div className="mb-6 rounded-xl border border-slate-800 bg-slate-900 p-4 sm:p-5">
          <h2 className="mb-4 text-lg font-semibold text-slate-100">{t("live.configuration")}</h2>
          <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-slate-500">{t("history.detail.rebuysLabel")}</dt>
              <dd className="text-slate-200">
                {!history.allowRebuys
                  ? t("live.notAllowed")
                  : history.rebuyLimitType === "limited"
                    ? t("live.limitedMax", { max: history.maxRebuysPerPlayer })
                    : t("setup.unlimited")}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">{t("live.addOnsLabel")}</dt>
              <dd className="text-slate-200">{history.allowAddOn ? t("live.allowed") : t("live.notAllowed")}</dd>
            </div>
            <div>
              <dt className="text-slate-500">{t("live.ownerLabel")}</dt>
              <dd className="text-slate-200">{history.ownerUsername}</dd>
            </div>
            <div>
              <dt className="text-slate-500">{t("history.detail.tournamentId")}</dt>
              <dd className="font-mono text-slate-200">{history.tournamentId}</dd>
            </div>
          </dl>
        </div>

        <div className="mb-6 rounded-xl border border-slate-800 bg-slate-900 p-4 sm:p-5">
          <h2 className="mb-4 text-lg font-semibold text-slate-100">{t("setup.blindStructure")}</h2>
          <LevelsEditor levels={history.levels} disabled onChange={() => {}} />
        </div>

        <div className="mb-6 rounded-xl border border-slate-800 bg-slate-900 p-4 sm:p-5">
          <h2 className="mb-4 text-lg font-semibold text-slate-100">{t("nav.players")}</h2>
          <ul className="flex flex-col gap-2">
            {history.players.map((player) => (
              <li
                key={player.id}
                className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950 px-4 py-2 text-sm"
              >
                <span className="text-slate-100">
                  {player.name}{" "}
                  {player.status === "eliminated" && (
                    <span className="text-slate-500">{t("history.detail.eliminatedTag")}</span>
                  )}
                </span>
                <span className="text-slate-400">
                  {t("history.detail.buyIns", { count: player.buyIns })} ·{" "}
                  {t("history.detail.rebuysCount", { count: player.rebuys })} ·{" "}
                  {t("history.detail.addOnsCount", { count: player.addOns })}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 sm:p-5">
          <h2 className="mb-4 text-lg font-semibold text-slate-100">{t("history.detail.eventTimeline")}</h2>
          <Timeline events={events} />
        </div>
      </div>
    </div>
  );
}
