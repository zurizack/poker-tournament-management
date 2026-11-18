import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../lib/api";
import { LevelsEditor } from "../../components/LevelsEditor";
import { formatDuration, formatDateTime, formatChips } from "../../utils/format";

const EVENT_LABELS = {
  started: "Clock started",
  resumed: "Clock resumed",
  paused: "Paused",
  reset: "Clock reset",
  level_skipped: "Level skipped",
  level_reversed: "Reverted to previous level",
  structure_updated: "Blind structure edited",
  starting_stack_updated: "Starting stack changed",
  tournament_ended: "Tournament ended",
};

function describeEvent(event) {
  switch (event.type) {
    case "paused":
      return event.durationMs ? `Paused for ${formatDuration(event.durationMs)}` : "Paused";
    case "level_skipped":
      return `Skipped from level ${event.fromLevelIndex + 1} to level ${event.toLevelIndex + 1}`;
    case "level_reversed":
      return `Reverted from level ${event.fromLevelIndex + 1} to level ${event.toLevelIndex + 1}`;
    case "structure_updated":
      return `Blind structure edited (${event.previousLevelCount} → ${event.newLevelCount} levels)`;
    case "starting_stack_updated":
      return `Starting stack changed from ${formatChips(event.previousValue)} to ${formatChips(event.newValue)}`;
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
  if (events.length === 0) {
    return <p className="text-sm text-slate-500">No runtime interventions were recorded.</p>;
  }
  return (
    <ol className="flex flex-col gap-3">
      {events.map((event, index) => (
        <li key={index} className="flex gap-3 border-l-2 border-slate-800 pl-4">
          <div className="flex-1">
            <div className="text-sm font-semibold text-slate-200">
              {EVENT_LABELS[event.type] || event.type}
            </div>
            {describeEvent(event) && <div className="text-sm text-slate-400">{describeEvent(event)}</div>}
            <div className="text-xs text-slate-500">{formatDateTime(event.timestamp)}</div>
          </div>
        </li>
      ))}
    </ol>
  );
}

export function HistoryDetailPage() {
  const { historyId } = useParams();
  const { token } = useAuth();
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
        Loading report...
      </div>
    );
  }

  if (error || !history) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-2 bg-slate-950 px-4 text-center text-slate-100">
        <p className="text-xl font-semibold text-red-400">{error || "History entry not found"}</p>
        <Link to="/manager/history" className="text-slate-400 hover:text-slate-200">
          ← Back to history
        </Link>
      </div>
    );
  }

  const events = [...history.events].sort((a, b) => a.timestamp - b.timestamp);

  return (
    <div className="min-h-screen bg-slate-950 px-6 py-10 text-slate-100">
      <div className="mx-auto max-w-3xl">
        <Link to="/manager/history" className="text-sm text-slate-500 hover:text-slate-300">
          ← History
        </Link>
        <div className="mb-6 mt-2 flex items-center justify-between">
          <h1 className="text-2xl font-bold">{history.name || "Unnamed Tournament"}</h1>
          <span className="rounded-full bg-slate-800 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-slate-400">
            Read-only report
          </span>
        </div>
        <p className="mb-6 text-sm text-slate-500">
          {formatDateTime(history.startedAt)} — {formatDateTime(history.endedAt)}
        </p>

        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Duration" value={formatDuration(history.activeDurationMs)} />
          <StatCard label="Entries" value={history.totalEntries} />
          <StatCard label="Re-buys" value={history.totalRebuys} />
          <StatCard label="Add-ons" value={history.totalAddOns} />
          <StatCard label="Players" value={history.uniquePlayers} />
          <StatCard label="Final Level" value={history.finalLevelIndex + 1} />
          <StatCard label="Starting Stack" value={formatChips(history.startingStack)} />
          <StatCard
            label="Gross Duration"
            value={formatDuration(history.grossDurationMs)}
          />
        </div>

        <div className="mb-6 rounded-xl border border-slate-800 bg-slate-900 p-4 sm:p-5">
          <h2 className="mb-4 text-lg font-semibold text-slate-100">Configuration</h2>
          <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-slate-500">Re-buys</dt>
              <dd className="text-slate-200">
                {!history.allowRebuys
                  ? "Not allowed"
                  : history.rebuyLimitType === "limited"
                    ? `Limited — max ${history.maxRebuysPerPlayer} per player`
                    : "Unlimited"}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Add-ons</dt>
              <dd className="text-slate-200">{history.allowAddOn ? "Allowed" : "Not allowed"}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Owner</dt>
              <dd className="text-slate-200">{history.ownerUsername}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Tournament ID</dt>
              <dd className="font-mono text-slate-200">{history.tournamentId}</dd>
            </div>
          </dl>
        </div>

        <div className="mb-6 rounded-xl border border-slate-800 bg-slate-900 p-4 sm:p-5">
          <h2 className="mb-4 text-lg font-semibold text-slate-100">Blind Structure</h2>
          <LevelsEditor levels={history.levels} disabled onChange={() => {}} />
        </div>

        <div className="mb-6 rounded-xl border border-slate-800 bg-slate-900 p-4 sm:p-5">
          <h2 className="mb-4 text-lg font-semibold text-slate-100">Players</h2>
          <ul className="flex flex-col gap-2">
            {history.players.map((player) => (
              <li
                key={player.id}
                className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950 px-4 py-2 text-sm"
              >
                <span className="text-slate-100">
                  {player.name} {player.status === "eliminated" && <span className="text-slate-500">(eliminated)</span>}
                </span>
                <span className="text-slate-400">
                  {player.buyIns} buy-in{player.buyIns === 1 ? "" : "s"} · {player.rebuys} rebuy
                  {player.rebuys === 1 ? "" : "s"} · {player.addOns} add-on{player.addOns === 1 ? "" : "s"}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 sm:p-5">
          <h2 className="mb-4 text-lg font-semibold text-slate-100">Event Timeline</h2>
          <Timeline events={events} />
        </div>
      </div>
    </div>
  );
}
