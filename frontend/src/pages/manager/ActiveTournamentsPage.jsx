import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../lib/api";
import { TournamentSection } from "../../components/TournamentSection";
import { PendingInvitations } from "../../components/PendingInvitations";

export function ActiveTournamentsPage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [owned, setOwned] = useState([]);
  const [managed, setManaged] = useState([]);
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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

  return (
    <div className="px-6 py-10">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold">Active Tournaments</h1>
          <button
            type="button"
            onClick={() => navigate("/manager/setup")}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
          >
            + Create New Tournament
          </button>
        </div>

        {error && <p className="mb-4 text-sm text-red-400">{error}</p>}

        {loading ? (
          <p className="text-slate-500">Loading tournaments...</p>
        ) : (
          <div className="flex flex-col gap-8">
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
        )}
      </div>
    </div>
  );
}
