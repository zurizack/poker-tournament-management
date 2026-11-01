import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../lib/api";

export function DashboardPage() {
  const { token, username, logout } = useAuth();
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    api
      .listTournaments(token)
      .then((data) => setTournaments(data.tournaments))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
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

  return (
    <div className="min-h-screen bg-slate-950 px-6 py-10 text-slate-100">
      <div className="mx-auto max-w-2xl">
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

        <button
          type="button"
          onClick={handleCreate}
          disabled={creating}
          className="mb-8 w-full rounded-lg bg-emerald-600 px-4 py-3 text-base font-semibold text-white transition-colors hover:bg-emerald-500 disabled:opacity-50"
        >
          {creating ? "Creating..." : "+ Create New Tournament"}
        </button>

        {error && <p className="mb-4 text-center text-sm text-red-400">{error}</p>}

        {loading ? (
          <p className="text-center text-slate-500">Loading tournaments...</p>
        ) : tournaments.length === 0 ? (
          <p className="text-center text-slate-500">No tournaments yet. Create one to get started.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {tournaments.map((t) => (
              <li key={t.tournamentId}>
                <button
                  type="button"
                  onClick={() => navigate(`/manager/${t.tournamentId}`)}
                  className="flex w-full items-center justify-between rounded-lg border border-slate-800 bg-slate-900 px-5 py-4 text-left hover:border-emerald-600"
                >
                  <div>
                    <div className="font-mono text-lg font-semibold tracking-widest">{t.tournamentId}</div>
                    <div className="text-sm text-slate-500">
                      {t.playerCount} player{t.playerCount === 1 ? "" : "s"} · {t.status}
                    </div>
                  </div>
                  <span className="text-slate-500">Manage →</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
