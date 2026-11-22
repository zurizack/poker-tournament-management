import { useParams } from "react-router-dom";
import { ClockDisplay } from "../components/ClockDisplay";
import { LanguageToggle } from "../components/LanguageToggle";
import { useLanguage } from "../context/LanguageContext";
import { useTournamentSocket } from "../hooks/useTournamentSocket";

export function PlayerView() {
  const { tournamentId } = useParams();
  const { t } = useLanguage();
  const { state, connected, error, connectionIssue } = useTournamentSocket({ tournamentId });

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-2 bg-slate-950 px-4 text-center text-slate-100">
        <p className="text-xl font-semibold text-red-400">{error}</p>
        <p className="text-slate-500">{t("clockView.doubleCheck")}</p>
      </div>
    );
  }

  if (connectionIssue && !connected) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-2 bg-slate-950 px-4 text-center text-slate-100">
        <p className="text-xl font-semibold text-amber-400">{connectionIssue}</p>
        <p className="text-slate-500">{t("live.connectionRecover")}</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-950">
      <div
        className={`flex items-center justify-between px-4 py-1 text-xs font-semibold uppercase tracking-widest ${
          connected ? "bg-emerald-900 text-emerald-300" : "bg-red-900 text-red-200"
        }`}
      >
        <span />
        <span>{connected ? t("clockView.tournamentLabel", { id: tournamentId }) : t("clockView.connecting")}</span>
        <LanguageToggle className="rounded px-2 py-0.5 text-[10px] font-semibold normal-case text-inherit hover:bg-black/20" />
      </div>

      {state ? (
        state.status === "ended" ? (
          <div className="flex flex-1 items-center justify-center text-center text-xl text-slate-300">
            {t("clockView.ended")}
          </div>
        ) : (
          <ClockDisplay
            clockState={state.clock}
            totals={state.totals}
            prize={state.prize}
            allowAddOn={state.allowAddOn}
            allowRebuys={state.allowRebuys}
            rebuyCutoffLevel={state.rebuyCutoffLevel}
          />
        )
      ) : (
        <div className="flex flex-1 items-center justify-center text-xl text-slate-500">
          {t("clockView.loadingClock")}
        </div>
      )}
    </div>
  );
}
