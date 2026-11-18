import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useTournamentSocket } from "../../hooks/useTournamentSocket";
import { ClockDisplay } from "../../components/ClockDisplay";
import { ControlPanel } from "../../components/ControlPanel";
import { PlayerManager } from "../../components/PlayerManager";
import { AdminManager } from "../../components/AdminManager";
import { LevelsEditor } from "../../components/LevelsEditor";
import { api } from "../../lib/api";

const TABS = [
  { id: "clock", label: "Live Clock" },
  { id: "structure", label: "Blind Structure" },
  { id: "settings", label: "Settings" },
];

function TabBar({ activeTab, onChange }) {
  return (
    <div className="flex gap-1 border-b border-slate-800 px-4 sm:px-6">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={`-mb-px border-b-2 px-3 py-3 text-sm font-semibold transition-colors ${
            activeTab === tab.id
              ? "border-emerald-500 text-emerald-400"
              : "border-transparent text-slate-500 hover:text-slate-300"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

function BlindStructureTab({ state, sendManagerAction }) {
  const [levels, setLevels] = useState(state.clock.levels);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  // Resync if another manager tab saved first, or after our own save pushes
  // a fresh broadcast back down.
  useEffect(() => {
    setLevels(state.clock.levels);
  }, [state.clock.levels]);

  async function handleSave() {
    setSaving(true);
    setMessage(null);
    try {
      await sendManagerAction("manager:updateStructure", { levels });
      setMessage({ type: "success", text: "Structure saved" });
    } catch (err) {
      setMessage({ type: "error", text: err.message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 sm:p-5">
      <h2 className="mb-1 text-lg font-semibold text-slate-100">Blind Structure</h2>
      <p className="mb-4 text-sm text-slate-500">
        Currently on level {state.clock.currentLevelIndex + 1} of {state.clock.totalLevels}. Edits save live —
        no need to pause.
      </p>

      <LevelsEditor levels={levels} onChange={setLevels} />

      <button
        type="button"
        disabled={saving}
        onClick={handleSave}
        className="mt-3 w-full rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50 sm:w-auto"
      >
        {saving ? "Saving..." : "Save Structure"}
      </button>

      {message && (
        <p className={`mt-3 text-sm ${message.type === "error" ? "text-red-400" : "text-emerald-400"}`}>
          {message.text}
        </p>
      )}
    </div>
  );
}

function SettingsTab({ state, username, ending, onEndTournament }) {
  const [showAdmins, setShowAdmins] = useState(false);
  const { token } = useAuth();
  const isOwner = state.ownerUsername === username;

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 sm:p-5">
        <h2 className="mb-4 text-lg font-semibold text-slate-100">Configuration</h2>
        <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-slate-500">Starting stack</dt>
            <dd className="text-slate-200">{state.totals.startingStack}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Re-buys</dt>
            <dd className="text-slate-200">
              {!state.allowRebuys
                ? "Not allowed"
                : state.rebuyLimitType === "limited"
                  ? `Limited — max ${state.maxRebuysPerPlayer} per player`
                  : "Unlimited"}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Add-ons</dt>
            <dd className="text-slate-200">{state.allowAddOn ? "Allowed" : "Not allowed"}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Owner</dt>
            <dd className="text-slate-200">{state.ownerUsername}</dd>
          </div>
        </dl>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 sm:p-5">
        <h2 className="mb-4 text-lg font-semibold text-slate-100">Management</h2>
        <div className="flex flex-wrap gap-3">
          {isOwner && (
            <button
              type="button"
              onClick={() => setShowAdmins(true)}
              className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-700"
            >
              Floor Managers
            </button>
          )}
          <button
            type="button"
            disabled={ending}
            onClick={onEndTournament}
            className="rounded-lg bg-red-900 px-4 py-2 text-sm font-semibold text-red-200 hover:bg-red-800 disabled:opacity-50"
          >
            {ending ? "Ending..." : "End Tournament"}
          </button>
        </div>
      </div>

      {showAdmins && (
        <AdminManager token={token} tournamentId={state.id} onClose={() => setShowAdmins(false)} />
      )}
    </div>
  );
}

export function TournamentManagerPage() {
  const { tournamentId } = useParams();
  const { token, username } = useAuth();
  const navigate = useNavigate();
  const [ending, setEnding] = useState(false);
  const [activeTab, setActiveTab] = useState("clock");
  const [historyId, setHistoryId] = useState(null);
  const { state, connected, error, connectionIssue, sendManagerAction } = useTournamentSocket({
    tournamentId,
    token,
  });

  useEffect(() => {
    if (state?.status !== "ended") return;
    api
      .listHistory(token, { tournamentId })
      .then((data) => setHistoryId(data.history[0]?.historyId ?? null))
      .catch(() => setHistoryId(null));
  }, [state?.status, tournamentId, token]);

  async function handleEndTournament() {
    if (!window.confirm("End this tournament? This can't be undone.")) return;
    setEnding(true);
    try {
      await api.endTournament(token, tournamentId);
      navigate("/manager");
    } catch (err) {
      setEnding(false);
      window.alert(err.message);
    }
  }

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

  if (connectionIssue && !connected) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-2 bg-slate-950 px-4 text-center text-slate-100">
        <p className="text-xl font-semibold text-amber-400">{connectionIssue}</p>
        <p className="text-slate-500">This should recover automatically once the server responds.</p>
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

  if (state.status === "ended") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-950 px-4 text-center text-slate-100">
        <p className="text-xl font-semibold text-slate-300">This tournament has ended.</p>
        {historyId && (
          <Link
            to={`/manager/history/${historyId}`}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
          >
            View History Report →
          </Link>
        )}
        <Link to="/manager" className="text-slate-400 hover:text-slate-200">
          ← Back to dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 px-4 py-4 sm:px-6">
        <div>
          <Link to="/manager" className="text-sm text-slate-500 hover:text-slate-300">
            ← Dashboard
          </Link>
          <h1 className="text-2xl font-bold text-slate-100">{state.name || "Unnamed Tournament"}</h1>
          <p className="font-mono text-sm tracking-widest text-slate-500">{tournamentId}</p>
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

      <TabBar activeTab={activeTab} onChange={setActiveTab} />

      <div className="mx-auto max-w-4xl px-3 py-4 sm:px-6 sm:py-6">
        {activeTab === "clock" && (
          <>
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

            <PlayerManager
              players={state.players}
              startingStack={state.totals.startingStack}
              allowRebuys={state.allowRebuys}
              rebuyLimitType={state.rebuyLimitType}
              maxRebuysPerPlayer={state.maxRebuysPerPlayer}
              allowAddOn={state.allowAddOn}
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
          </>
        )}

        {activeTab === "structure" && (
          <BlindStructureTab state={state} sendManagerAction={sendManagerAction} />
        )}

        {activeTab === "settings" && (
          <SettingsTab state={state} username={username} ending={ending} onEndTournament={handleEndTournament} />
        )}
      </div>
    </div>
  );
}
