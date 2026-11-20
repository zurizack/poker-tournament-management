import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useLanguage } from "../../context/LanguageContext";
import { api } from "../../lib/api";
import { PendingInvitations } from "../../components/PendingInvitations";
import { MirroredGlyph } from "../../components/MirroredGlyph";
import { formatDateTime, formatDuration } from "../../utils/format";

const RECENT_COUNT = 5;

function OverviewCard({ title, viewAllTo, viewAllLabel, children }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-100">{title}</h2>
        <Link to={viewAllTo} className="text-sm text-slate-500 hover:text-slate-300">
          {viewAllLabel} <MirroredGlyph>→</MirroredGlyph>
        </Link>
      </div>
      {children}
    </div>
  );
}

export function DashboardPage() {
  const { token, username } = useAuth();
  const { t, locale } = useLanguage();
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
          <h1 className="text-2xl font-bold">{t("nav.dashboard")}</h1>
          <p className="text-sm text-slate-400">{t("nav.signedInAs", { username })}</p>
        </div>

        {error && <p className="mb-4 text-sm text-red-400">{error}</p>}

        {loading ? (
          <p className="text-slate-500">{t("dashboard.loadingOverview")}</p>
        ) : (
          <div className="flex flex-col gap-6">
            <button
              type="button"
              onClick={() => navigate("/manager/setup")}
              className="w-full rounded-lg bg-emerald-600 px-4 py-3 text-base font-semibold text-white transition-colors hover:bg-emerald-500 sm:w-auto"
            >
              {t("dashboard.createTournament")}
            </button>

            {pending.length > 0 && (
              <PendingInvitations token={token} invitations={pending} onResolved={refreshInvitations} />
            )}

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <OverviewCard
                title={t("dashboard.activeTournaments")}
                viewAllTo="/manager/tournaments"
                viewAllLabel={t("common.viewAll")}
              >
                {recentTournaments.length === 0 ? (
                  <p className="text-sm text-slate-500">{t("dashboard.noActiveTournaments")}</p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {recentTournaments.map((tournament) => (
                      <li key={tournament.tournamentId}>
                        <button
                          type="button"
                          onClick={() => navigate(`/manager/${tournament.tournamentId}`)}
                          className="flex w-full items-center justify-between rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 text-start hover:border-emerald-600"
                        >
                          <span className="font-semibold text-slate-100">
                            {tournament.name || t("common.unnamedTournament")}
                          </span>
                          <span className="text-sm text-slate-500">
                            {tournament.playerCount}{" "}
                            {tournament.playerCount === 1 ? t("common.player") : t("common.playersPlural")}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </OverviewCard>

              <OverviewCard
                title={t("nav.templates")}
                viewAllTo="/manager/templates"
                viewAllLabel={t("common.viewAll")}
              >
                {recentTemplates.length === 0 ? (
                  <p className="text-sm text-slate-500">{t("dashboard.noTemplatesYet")}</p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {recentTemplates.map((template) => (
                      <li
                        key={template.templateId}
                        className="rounded-lg border border-slate-800 bg-slate-950 px-4 py-3"
                      >
                        <div className="font-semibold text-slate-100">{template.name}</div>
                        <div className="text-xs text-slate-500">
                          {template.ownerUsername === username
                            ? t("dashboard.createdByMe")
                            : t("dashboard.sharedBy", { owner: template.ownerUsername })}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </OverviewCard>

              <OverviewCard
                title={t("nav.history")}
                viewAllTo="/manager/history"
                viewAllLabel={t("common.viewAll")}
              >
                {recentHistory.length === 0 ? (
                  <p className="text-sm text-slate-500">{t("dashboard.noHistoryYet")}</p>
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
                          className="flex w-full items-center justify-between text-start"
                        >
                          <div>
                            <div className="font-semibold text-slate-100">
                              {h.name || t("common.unnamedTournament")}
                            </div>
                            <div className="text-xs text-slate-500">{formatDateTime(h.endedAt, locale)}</div>
                          </div>
                          <span className="text-sm text-slate-500">
                            {formatDuration(h.activeDurationMs, t)}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </OverviewCard>

              <OverviewCard
                title={t("nav.players")}
                viewAllTo="/manager/players"
                viewAllLabel={t("common.viewAll")}
              >
                <p className="mb-3 text-sm text-slate-400">
                  {playerStats.total} {playerStats.total === 1 ? t("common.player") : t("common.playersPlural")}{" "}
                  {t("dashboard.inYourDirectory")}
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
                          {p.tournamentsPlayed}{" "}
                          {p.tournamentsPlayed === 1
                            ? t("players.tournamentPlayed")
                            : t("players.tournamentsPlayedPlural")}
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
