import { Link, useParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useTournamentSocket } from "../../hooks/useTournamentSocket";
import { ClockDisplay } from "../../components/ClockDisplay";
import { ControlPanel } from "../../components/ControlPanel";
import { StructureEditor } from "../../components/StructureEditor";
import { PlayerManager } from "../../components/PlayerManager";

export function TournamentManagerPage() {
  const { tournamentId } = useParams();
  const { token } = useAuth();
  const { state, connected, error, sendManagerAction } = useTournamentSocket({ tournamentId, token });

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-2 bg-slate-950 px-4 text-center text-slate-100">
        <p className="text-xl font-semibold text-red-400">{error}</p>
        <Link to="/manager" className="text-slate-400 hover:text-slate-200">
          ← Back to dashboard
        </Link>
      </div>
    );
  }

  if (!state) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950 text-xl text-slate-500">
        Loading tournament...
      </div>
    );
  }

  const isRunning = state.clock.status === "running";

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 px-4 py-4 sm:px-6">
        <div>
          <Link to="/manager" className="text-sm text-slate-500 hover:text-slate-300">
            ← Dashboard
          </Link>
          <h1 className="font-mono text-2xl font-bold tracking-widest">{tournamentId}</h1>
          <p className="text-sm text-slate-400">Share this ID with players to join</p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-widest ${
            connected ? "bg-emerald-900 text-emerald-300" : "bg-red-900 text-red-200"
          }`}
        >
          {connected ? "Connected" : "Disconnected"}
        </span>
      </div>

      <div className="mx-auto max-w-4xl px-3 py-4 sm:px-6 sm:py-6">
        <div className="mb-6 overflow-hidden rounded-xl border border-slate-800">
          <ClockDisplay clockState={state.clock} totals={state.totals} compact />
          <ControlPanel
            status={state.clock.status}
            onStart={() => sendManagerAction("manager:start")}
            onPause={() => sendManagerAction("manager:pause")}
            onReset={() => sendManagerAction("manager:reset")}
            onSkipLevel={() => sendManagerAction("manager:skipLevel")}
            onPreviousLevel={() => sendManagerAction("manager:previousLevel")}
          />
        </div>

        <div className="flex flex-col gap-6">
          <StructureEditor
            levels={state.clock.levels}
            disabled={isRunning}
            onSave={(levels) => sendManagerAction("manager:updateStructure", { levels })}
          />

          <PlayerManager
            players={state.players}
            startingStack={state.totals.startingStack}
            onSetStartingStack={(amount) => sendManagerAction("manager:setStartingStack", { amount })}
            onAddPlayer={(name) => sendManagerAction("manager:addPlayer", { name })}
            onRemovePlayer={(playerId) => sendManagerAction("manager:removePlayer", { playerId })}
            onEliminatePlayer={(playerId) => sendManagerAction("manager:eliminatePlayer", { playerId })}
            onReinstatePlayer={(playerId) => sendManagerAction("manager:reinstatePlayer", { playerId })}
            onRecordBuyIn={(playerId) => sendManagerAction("manager:recordBuyIn", { playerId })}
            onUndoBuyIn={(playerId) => sendManagerAction("manager:undoBuyIn", { playerId })}
            onRecordRebuy={(playerId) => sendManagerAction("manager:recordRebuy", { playerId })}
            onUndoRebuy={(playerId) => sendManagerAction("manager:undoRebuy", { playerId })}
            onRecordAddOn={(playerId) => sendManagerAction("manager:recordAddOn", { playerId })}
            onUndoAddOn={(playerId) => sendManagerAction("manager:undoAddOn", { playerId })}
          />
        </div>
      </div>
    </div>
  );
}
