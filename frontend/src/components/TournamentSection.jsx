// Shared by DashboardPage (recent-only slice) and ActiveTournamentsPage
// (full list) so both render tournament cards identically.
export function TournamentSection({ title, tournaments, emptyText, onOpen, showOwner }) {
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
                  <div className="text-lg font-semibold text-slate-100">{t.name || "Unnamed Tournament"}</div>
                  <div className="font-mono text-xs tracking-widest text-slate-500">{t.tournamentId}</div>
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
