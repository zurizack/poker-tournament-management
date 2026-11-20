import { useState } from "react";
import { useLanguage } from "../context/LanguageContext";
import { api } from "../lib/api";

// Dashboard card for the current user's own pending invitations — tournaments
// another owner has invited them to co-manage but they haven't responded to
// yet. Only rendered by the dashboard when non-empty.
export function PendingInvitations({ token, invitations, onResolved }) {
  const { t } = useLanguage();
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState(null);

  async function respond(tournamentId, action) {
    setBusyId(tournamentId);
    setError(null);
    try {
      if (action === "accept") {
        await api.acceptInvitation(token, tournamentId);
      } else {
        await api.declineInvitation(token, tournamentId);
      }
      onResolved();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mb-6 rounded-xl border border-amber-800/60 bg-amber-950/20 p-4 sm:p-5">
      <h2 className="mb-3 text-lg font-semibold text-amber-300">{t("invites.title")}</h2>

      {error && <p className="mb-3 text-sm text-red-400">{error}</p>}

      <ul className="flex flex-col gap-2">
        {invitations.map((inv) => (
          <li
            key={inv.tournamentId}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-800/40 bg-slate-950 px-4 py-3"
          >
            <div>
              <div className="text-base font-semibold text-slate-100">
                {inv.name || t("common.unnamedTournament")}
              </div>
              <div className="font-mono text-xs tracking-widest text-slate-500">{inv.tournamentId}</div>
              <div className="text-xs text-slate-500">{t("invites.invitedBy", { owner: inv.ownerUsername })}</div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={busyId === inv.tournamentId}
                onClick={() => respond(inv.tournamentId, "accept")}
                className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
              >
                {t("invites.accept")}
              </button>
              <button
                type="button"
                disabled={busyId === inv.tournamentId}
                onClick={() => respond(inv.tournamentId, "decline")}
                className="rounded-lg bg-slate-800 px-3 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-700 disabled:opacity-50"
              >
                {t("invites.decline")}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
