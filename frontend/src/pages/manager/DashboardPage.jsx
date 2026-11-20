import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../lib/api";
import { PendingInvitations } from "../../components/PendingInvitations";
import { formatDateTime, formatDuration } from "../../utils/format";

const RECENT_COUNT = 5;

function OverviewCard({ title, viewAllTo, children }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-100">{title}</h2>
        <Link to={viewAllTo} className="text-sm text-slate-500 hover:text-slate-300">
          View All →
        </Link>
      </div>
      {children}
    </div>
  );
}

export function DashboardPage() {
  const { token, username } = useAuth();
  const navigate = useNavigate();

  const [pending, setPending] = useState([]);
  const [recentTournaments, setRecentTournaments] = useState([]);
  const [recentTemplates, setRecentTemplates] = useState([]);
  const [recentHistory, setRecentHistory] = useState([]);
  const [playerStats, setPlayerStats] = useState({ total: 0, recent: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  function refreshInvitations() {
    return api.listTournaments(token).then((data) => setPending(data.pending));
  }

  useEffect(() => {
    Promise.all([
      api.listTournaments(token).then((data) => {
        setPending(data.pending);
        const merged = [...data.owned, ...data.managed].sort((a, b) => b.createdAt - a.createdAt);
        setRecentTournaments(merged.slice(0, RECENT_COUNT));
      }),
      api.listTemplates(token).then((data) => setRecentTemplates(data.templates.slice(0, RECENT_COUNT))),
      api.listHistory(token).then((data) => setRecentHistory(data.history.slice(0, RECENT_COUNT))),
      api.listPlayers(token).then((data) =>
        setPlayerStats({ total: data.players.length, recent: data.players.slice(0, RECENT_COUNT) }),
      ),
    ])
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <div className="px-6 py-10">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8">
          <h1 className="text-2xl font-bold">דף הבית</h1>
          <p className="text-sm text-slate-400">Signed in as {username}</p>
        </div>

        {error && <p className="mb-4 text-sm text-red-400">{error}</p>}

        {loading ? (
          <p className="text-slate-500">Loading overview...</p>
        ) : (
          <div className="flex flex-col gap-6">
            <button
              type="button"
              onClick={() => navigate("/manager/setup")}
              className="w-full rounded-lg bg-emerald-600 px-4 py-3 text-base font-semibold text-white transition-colors hover:bg-emerald-500 sm:w-auto"
            >
              + Create New Tournament
            </button>

            {pending.length > 0 && (
              <PendingInvitations token={token} invitations={pending} onResolved={refreshInvitations} />
            )}

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <OverviewCard title="Active Tournaments" viewAllTo="/manager/tournaments">
                {recentTournaments.length === 0 ? (
                  <p className="text-sm text-slate-500">No active tournaments yet.</p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {recentTournaments.map((t) => (
                      <li key={t.tournamentId}>
                        <button
                          type="button"
                          onClick={() => navigate(`/manager/${t.tournamentId}`)}
                          className="flex w-full items-center justify-between rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 text-left hover:border-emerald-600"
                        >
                          <span className="font-semibold text-slate-100">{t.name || "Unnamed Tournament"}</span>
                          <span className="text-sm text-slate-500">
                            {t.playerCount} player{t.playerCount === 1 ? "" : "s"}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </OverviewCard>

              <OverviewCard title="Templates" viewAllTo="/manager/templates">
                {recentTemplates.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    No templates yet. Save one from the tournament setup form.
                  </p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {recentTemplates.map((t) => (
                      <li
                        key={t.templateId}
                        className="rounded-lg border border-slate-800 bg-slate-950 px-4 py-3"
                      >
                        <div className="font-semibold text-slate-100">{t.name}</div>
                        <div className="text-xs text-slate-500">
                          {t.ownerUsername === username ? "Created by me" : `Shared by ${t.ownerUsername}`}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </OverviewCard>

              <OverviewCard title="History" viewAllTo="/manager/history">
                {recentHistory.length === 0 ? (
                  <p className="text-sm text-slate-500">No completed tournaments yet.</p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {recentHistory.map((h) => (
                      <li
                        key={h.historyId}
                        className="rounded-lg border border-slate-800 bg-slate-950 px-4 py-3"
                      >
                        <button
                          type="button"
                          onClick={() => navigate(`/manager/history/${h.historyId}`)}
                          className="flex w-full items-center justify-between text-left"
                        >
                          <div>
                            <div className="font-semibold text-slate-100">{h.name || "Unnamed Tournament"}</div>
                            <div className="text-xs text-slate-500">{formatDateTime(h.endedAt)}</div>
                          </div>
                          <span className="text-sm text-slate-500">{formatDuration(h.activeDurationMs)}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </OverviewCard>

              <OverviewCard title="Players" viewAllTo="/manager/players">
                <p className="mb-3 text-sm text-slate-400">
                  {playerStats.total} player{playerStats.total === 1 ? "" : "s"} in your directory
                </p>
                {playerStats.recent.length > 0 && (
                  <ul className="flex flex-col gap-2">
                    {playerStats.recent.map((p) => (
                      <li
                        key={p.playerId}
                        className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950 px-4 py-3"
                      >
                        <span className="font-semibold text-slate-100">{p.name}</span>
                        <span className="text-xs text-slate-500">
                          {p.tournamentsPlayed} tournament{p.tournamentsPlayed === 1 ? "" : "s"}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </OverviewCard>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
