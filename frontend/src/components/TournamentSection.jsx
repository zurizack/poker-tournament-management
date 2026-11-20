import { useLanguage } from "../context/LanguageContext";
import { MirroredGlyph } from "./MirroredGlyph";

// Shared by DashboardPage (recent-only slice) and ActiveTournamentsPage
// (full list) so both render tournament cards identically.
export function TournamentSection({ title, tournaments, emptyText, onOpen, showOwner }) {
  const { t } = useLanguage();

  return (
    <div>
      <h2 className="mb-3 text-lg font-semibold text-slate-100">{title}</h2>
      {tournaments.length === 0 ? (
        <p className="text-sm text-slate-500">{emptyText}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {tournaments.map((tournament) => (
            <li key={tournament.tournamentId}>
              <button
                type="button"
                onClick={() => onOpen(tournament.tournamentId)}
                className="flex w-full items-center justify-between rounded-lg border border-slate-800 bg-slate-900 px-5 py-4 text-start hover:border-emerald-600"
              >
                <div>
                  <div className="text-lg font-semibold text-slate-100">
                    {tournament.name || t("common.unnamedTournament")}
                  </div>
                  <div className="font-mono text-xs tracking-widest text-slate-500">
                    {tournament.tournamentId}
                  </div>
                  <div className="text-sm text-slate-500">
                    {tournament.playerCount}{" "}
                    {tournament.playerCount === 1 ? t("common.player") : t("common.playersPlural")} ·{" "}
                    {t(`status.${tournament.status}`)}
                    {showOwner && (
                      <span className="ms-2 text-slate-600">
                        {t("tournaments.ownedBy", { owner: tournament.ownerUsername })}
                      </span>
                    )}
                  </div>
                </div>
                <span className="text-slate-500">
                  {t("common.manage")} <MirroredGlyph>→</MirroredGlyph>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
