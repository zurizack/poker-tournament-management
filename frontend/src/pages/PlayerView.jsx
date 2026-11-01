import { useParams } from "react-router-dom";
import { ClockDisplay } from "../components/ClockDisplay";
import { useTournamentSocket } from "../hooks/useTournamentSocket";

export function PlayerView() {
  const { tournamentId } = useParams();
  const { state, connected, error } = useTournamentSocket({ tournamentId });

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-2 bg-slate-950 px-4 text-center text-slate-100">
        <p className="text-xl font-semibold text-red-400">{error}</p>
        <p className="text-slate-500">Double-check the tournament ID and try again.</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-950">
      <div
        className={`px-4 py-1 text-center text-xs font-semibold uppercase tracking-widest ${
          connected ? "bg-emerald-900 text-emerald-300" : "bg-red-900 text-red-200"
        }`}
      >
        {connected ? `Tournament ${tournamentId}` : "Connecting..."}
      </div>

      {state ? (
        <ClockDisplay clockState={state.clock} totals={state.totals} />
      ) : (
        <div className="flex flex-1 items-center justify-center text-xl text-slate-500">
          Loading tournament clock...
        </div>
      )}
    </div>
  );
}
