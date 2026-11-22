import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useLanguage } from "../../context/LanguageContext";
import { useTournamentSocket } from "../../hooks/useTournamentSocket";
import { ClockDisplay } from "../../components/ClockDisplay";
import { ControlPanel } from "../../components/ControlPanel";
import { PlayerManager } from "../../components/PlayerManager";
import { AdminManager } from "../../components/AdminManager";
import { LevelsEditor } from "../../components/LevelsEditor";
import { PrizeConfigEditor } from "../../components/PrizeConfigEditor";
import { PrizePayoutTable } from "../../components/PrizePayoutTable";
import { MirroredGlyph } from "../../components/MirroredGlyph";
import { LanguageToggle } from "../../components/LanguageToggle";
import { api } from "../../lib/api";
import { formatChips } from "../../utils/format";

function TabBar({ activeTab, onChange }) {
  const { t } = useLanguage();
  const tabs = [
    { id: "clock", label: t("live.tabClock") },
    { id: "structure", label: t("setup.blindStructure") },
    { id: "prize", label: t("live.tabPrize") },
    { id: "settings", label: t("live.tabSettings") },
  ];

  return (
    <div className="flex gap-1 border-b border-slate-800 px-4 sm:px-6">
      {tabs.map((tab) => (
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
  const { t } = useLanguage();
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
      setMessage({ type: "success", text: t("live.structureSaved") });
    } catch (err) {
      setMessage({ type: "error", text: err.message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 sm:p-5">
      <h2 className="mb-1 text-lg font-semibold text-slate-100">{t("setup.blindStructure")}</h2>
      <p className="mb-4 text-sm text-slate-500">
        {t("live.structureNote", {
          current: state.clock.currentLevelIndex + 1,
          total: state.clock.totalLevels,
        })}
      </p>

      <LevelsEditor levels={levels} onChange={setLevels} />

      <button
        type="button"
        disabled={saving}
        onClick={handleSave}
        className="mt-3 w-full rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50 sm:w-auto"
      >
        {saving ? t("common.saving") : t("live.saveStructure")}
      </button>

      {message && (
        <p className={`mt-3 text-sm ${message.type === "error" ? "text-red-400" : "text-emerald-400"}`}>
          {message.text}
        </p>
      )}
    </div>
  );
}

// Live-editable — unlike allowRebuys/rebuyLimitType (setup-only, shown
// read-only in SettingsTab), the per-entry dollar amounts can be set or
// corrected at any point during a running tournament, same as
// StartingStackControl in PlayerManager. This is what actually makes the
// prize pool move: every broadcast already recomputes it from these amounts
// times the live entry/re-buy/add-on counts, so saving here is the only
// "trigger" needed.
function EntryFeesEditor({ state, sendManagerAction }) {
  const { t } = useLanguage();
  const [buyInAmount, setBuyInAmount] = useState(state.buyInAmount);
  const [rebuyAmount, setRebuyAmount] = useState(state.rebuyAmount);
  const [addOnAmount, setAddOnAmount] = useState(state.addOnAmount);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    setBuyInAmount(state.buyInAmount);
    setRebuyAmount(state.rebuyAmount);
    setAddOnAmount(state.addOnAmount);
  }, [state.buyInAmount, state.rebuyAmount, state.addOnAmount]);

  async function handleSave() {
    setSaving(true);
    setMessage(null);
    try {
      await sendManagerAction("manager:updateEntryFees", {
        buyInAmount: Number(buyInAmount) || 0,
        rebuyAmount: Number(rebuyAmount) || 0,
        addOnAmount: Number(addOnAmount) || 0,
      });
      setMessage({ type: "success", text: t("prize.entryFeesSaved") });
    } catch (err) {
      setMessage({ type: "error", text: err.message });
    } finally {
      setSaving(false);
    }
  }

  const fieldClass = "w-32 rounded border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100";

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 sm:p-5">
      <h2 className="mb-4 text-lg font-semibold text-slate-100">{t("prize.amountsHeading")}</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-sm text-slate-400">
          {t("prize.buyInAmountLabel")}
          <input
            type="number"
            min="0"
            value={buyInAmount}
            onChange={(e) => setBuyInAmount(e.target.value)}
            className={fieldClass}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-slate-400">
          {t("prize.rebuyAmountLabel")}
          <input
            type="number"
            min="0"
            value={rebuyAmount}
            onChange={(e) => setRebuyAmount(e.target.value)}
            className={fieldClass}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-slate-400">
          {t("prize.addOnAmountLabel")}
          <input
            type="number"
            min="0"
            value={addOnAmount}
            onChange={(e) => setAddOnAmount(e.target.value)}
            className={fieldClass}
          />
        </label>
      </div>
      <button
        type="button"
        disabled={saving}
        onClick={handleSave}
        className="mt-4 rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-100 hover:bg-slate-700 disabled:opacity-50"
      >
        {saving ? t("common.saving") : t("prize.saveAmounts")}
      </button>
      {message && (
        <p className={`mt-2 text-sm ${message.type === "error" ? "text-red-400" : "text-emerald-400"}`}>
          {message.text}
        </p>
      )}
    </div>
  );
}

function PrizeTab({ state, sendManagerAction }) {
  const { t } = useLanguage();
  const [config, setConfig] = useState(state.prizeConfig);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  // Resync if another manager tab saved first, or after our own save pushes
  // a fresh broadcast back down — same pattern as BlindStructureTab.
  useEffect(() => {
    setConfig(state.prizeConfig);
  }, [state.prizeConfig]);

  async function handleSave() {
    setSaving(true);
    setMessage(null);
    try {
      await sendManagerAction("manager:updatePrizeConfig", { prizeConfig: config });
      setMessage({ type: "success", text: t("prize.saved") });
    } catch (err) {
      setMessage({ type: "error", text: err.message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 sm:p-5">
        <h2 className="mb-4 text-lg font-semibold text-slate-100">{t("prize.heading")}</h2>
        <PrizePayoutTable prize={state.prize} />
      </div>

      <EntryFeesEditor state={state} sendManagerAction={sendManagerAction} />

      <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 sm:p-5">
        <PrizeConfigEditor config={config} onChange={setConfig} paidPlaces={state.prize.paidPlaces} />

        <button
          type="button"
          disabled={saving}
          onClick={handleSave}
          className="mt-6 w-full rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50 sm:w-auto"
        >
          {saving ? t("common.saving") : t("prize.save")}
        </button>

        {message && (
          <p className={`mt-3 text-sm ${message.type === "error" ? "text-red-400" : "text-emerald-400"}`}>
            {message.text}
          </p>
        )}
      </div>
    </div>
  );
}

function SettingsTab({ state, username, ending, onEndTournament }) {
  const { t, locale } = useLanguage();
  const [showAdmins, setShowAdmins] = useState(false);
  const { token } = useAuth();
  const isOwner = state.ownerUsername === username;

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 sm:p-5">
        <h2 className="mb-4 text-lg font-semibold text-slate-100">{t("live.configuration")}</h2>
        <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-slate-500">{t("setup.startingStackLabel")}</dt>
            <dd className="text-slate-200">{formatChips(state.totals.startingStack, locale)}</dd>
          </div>
          <div>
            <dt className="text-slate-500">{t("prize.buyInAmountLabel")}</dt>
            <dd className="text-slate-200">{formatChips(state.buyInAmount, locale)}</dd>
          </div>
          <div>
            <dt className="text-slate-500">{t("prize.rebuyAmountLabel")}</dt>
            <dd className="text-slate-200">{formatChips(state.rebuyAmount, locale)}</dd>
          </div>
          <div>
            <dt className="text-slate-500">{t("prize.addOnAmountLabel")}</dt>
            <dd className="text-slate-200">{formatChips(state.addOnAmount, locale)}</dd>
          </div>
          <div>
            <dt className="text-slate-500">{t("live.rebuysLabel")}</dt>
            <dd className="text-slate-200">
              {!state.allowRebuys
                ? t("live.notAllowed")
                : state.rebuyLimitType === "limited"
                  ? t("live.limitedMax", { max: state.maxRebuysPerPlayer })
                  : t("setup.unlimited")}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">{t("live.addOnsLabel")}</dt>
            <dd className="text-slate-200">{state.allowAddOn ? t("live.allowed") : t("live.notAllowed")}</dd>
          </div>
          <div>
            <dt className="text-slate-500">{t("live.ownerLabel")}</dt>
            <dd className="text-slate-200">{state.ownerUsername}</dd>
          </div>
        </dl>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 sm:p-5">
        <h2 className="mb-4 text-lg font-semibold text-slate-100">{t("live.management")}</h2>
        <div className="flex flex-wrap gap-3">
          {isOwner && (
            <button
              type="button"
              onClick={() => setShowAdmins(true)}
              className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-700"
            >
              {t("live.floorManagers")}
            </button>
          )}
          <button
            type="button"
            disabled={ending}
            onClick={onEndTournament}
            className="rounded-lg bg-red-900 px-4 py-2 text-sm font-semibold text-red-200 hover:bg-red-800 disabled:opacity-50"
          >
            {ending ? t("live.ending") : t("live.endTournament")}
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
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [ending, setEnding] = useState(false);
  const [activeTab, setActiveTab] = useState("clock");
  const [historyId, setHistoryId] = useState(null);
  const [playerDirectory, setPlayerDirectory] = useState([]);
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

  // Fetched once for the "+ Add with a name instead" autocomplete — a
  // stale list here just means a returning player's name isn't suggested
  // yet this session, not a correctness issue.
  useEffect(() => {
    api
      .listPlayers(token)
      .then((data) => setPlayerDirectory(data.players.map((p) => p.name)))
      .catch(() => setPlayerDirectory([]));
  }, [token]);

  async function handleEndTournament() {
    if (!window.confirm(t("live.endConfirm"))) return;
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
          <MirroredGlyph>←</MirroredGlyph> {t("nav.dashboard")}
        </Link>
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

  if (!state) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950 text-xl text-slate-500">
        {t("live.loadingTournament")}
      </div>
    );
  }

  if (state.status === "ended") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-950 px-4 text-center text-slate-100">
        <p className="text-xl font-semibold text-slate-300">{t("live.ended")}</p>
        {historyId && (
          <Link
            to={`/manager/history/${historyId}`}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
          >
            {t("live.viewHistoryReport")} <MirroredGlyph>→</MirroredGlyph>
          </Link>
        )}
        <Link to="/manager" className="text-slate-400 hover:text-slate-200">
          <MirroredGlyph>←</MirroredGlyph> {t("nav.dashboard")}
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 px-4 py-4 sm:px-6">
        <div>
          <Link to="/manager" className="text-sm text-slate-500 hover:text-slate-300">
            <MirroredGlyph>←</MirroredGlyph> {t("nav.dashboard")}
          </Link>
          <h1 className="text-2xl font-bold text-slate-100">{state.name || t("common.unnamedTournament")}</h1>
          <p className="font-mono text-sm tracking-widest text-slate-500">{tournamentId}</p>
          <p className="text-sm text-slate-400">{t("live.shareIdHint")}</p>
        </div>
        <div className="flex items-center gap-3">
          <LanguageToggle />
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-widest ${
              connected ? "bg-emerald-900 text-emerald-300" : "bg-red-900 text-red-200"
            }`}
          >
            {connected ? t("live.connected") : t("live.disconnected")}
          </span>
        </div>
      </div>

      <TabBar activeTab={activeTab} onChange={setActiveTab} />

      <div className="mx-auto max-w-4xl px-3 py-4 sm:px-6 sm:py-6">
        {activeTab === "clock" && (
          <>
            <div className="mb-6 overflow-hidden rounded-xl border border-slate-800">
              <ClockDisplay clockState={state.clock} totals={state.totals} prize={state.prize} compact />
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
              playerDirectory={playerDirectory}
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

        {activeTab === "prize" && <PrizeTab state={state} sendManagerAction={sendManagerAction} />}

        {activeTab === "settings" && (
          <SettingsTab state={state} username={username} ending={ending} onEndTournament={handleEndTournament} />
        )}
      </div>
    </div>
  );
}
