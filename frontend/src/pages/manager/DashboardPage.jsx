import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../lib/api";
import { TemplateManager } from "../../components/TemplateManager";
import { PendingInvitations } from "../../components/PendingInvitations";

function TournamentSection({ title, tournaments, emptyText, onOpen, showOwner }) {
  return (
    <div>
      <h2 className="mb-3 text-lg font-semibold text-slate-100">{title}</h2>
      {tournaments.length === 0 ? (
        <p className="text-sm text-slate-500">{emptyText}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {tournaments.map((t) => (
            <li key={t.tournamentId}>
              <button
                type="button"
                onClick={() => onOpen(t.tournamentId)}
                className="flex w-full items-center justify-between rounded-lg border border-slate-800 bg-slate-900 px-5 py-4 text-left hover:border-emerald-600"
              >
                <div>
                  <div className="font-mono text-lg font-semibold tracking-widest">{t.tournamentId}</div>
                  <div className="text-sm text-slate-500">
                    {t.playerCount} player{t.playerCount === 1 ? "" : "s"} · {t.status}
                    {showOwner && <span className="ml-2 text-slate-600">· owned by {t.ownerUsername}</span>}
                  </div>
                </div>
                <span className="text-slate-500">Manage →</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function DashboardPage() {
  const { token, username, logout } = useAuth();
  const [owned, setOwned] = useState([]);
  const [managed, setManaged] = useState([]);
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();

  function refresh() {
    return api
      .listTournaments(token)
      .then((data) => {
        setOwned(data.owned);
        setManaged(data.managed);
        setPending(data.pending);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function handleCreate() {
    setCreating(true);
    setError(null);
    try {
      const { tournamentId } = await api.createTournament(token);
      navigate(`/manager/${tournamentId}`);
    } catch (err) {
      setError(err.message);
      setCreating(false);
    }
  }

  async function handleLaunchFromTemplate(templateId) {
    const { tournamentId } = await api.createTournament(token, templateId);
    navigate(`/manager/${tournamentId}`);
  }

  return (
    <div className="min-h-screen bg-slate-950 px-6 py-10 text-slate-100">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Manager Dashboard</h1>
            <p className="text-sm text-slate-400">Signed in as {username}</p>
          </div>
          <button
            type="button"
            onClick={logout}
            className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-700"
          >
            Log out
          </button>
        </div>

        {error && <p className="mb-4 text-center text-sm text-red-400">{error}</p>}

        {loading ? (
          <p className="text-center text-slate-500">Loading dashboard...</p>
        ) : (
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
            <div className="flex flex-col gap-6">
              <button
                type="button"
                onClick={handleCreate}
                disabled={creating}
                className="w-full rounded-lg bg-emerald-600 px-4 py-3 text-base font-semibold text-white transition-colors hover:bg-emerald-500 disabled:opacity-50"
              >
                {creating ? "Creating..." : "+ Create New Tournament"}
              </button>

              <TemplateManager token={token} onLaunch={handleLaunchFromTemplate} />
            </div>

            <div className="flex flex-col gap-6">
              {pending.length > 0 && (
                <PendingInvitations token={token} invitations={pending} onResolved={refresh} />
              )}

              <TournamentSection
                title="My Tournaments"
                tournaments={owned}
                emptyText="No tournaments yet. Create one to get started."
                onOpen={(id) => navigate(`/manager/${id}`)}
                showOwner={false}
              />

              <TournamentSection
                title="Managed Tournaments"
                tournaments={managed}
                emptyText="You're not co-managing any tournaments yet."
                onOpen={(id) => navigate(`/manager/${id}`)}
                showOwner
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
