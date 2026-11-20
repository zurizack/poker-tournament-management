import { useEffect, useState } from "react";
import { useLanguage } from "../context/LanguageContext";
import { formatChips } from "../utils/format";

// Mobile-first: 36px tap targets by default, shrinking down on sm+ where a
// mouse pointer makes the extra size unnecessary.
function Counter({ label, value, onIncrement, onDecrement, incrementDisabled, hint }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg bg-slate-900 px-2 py-1 sm:w-auto sm:justify-start sm:gap-1.5 sm:bg-transparent sm:px-0 sm:py-0">
      <span className="text-sm text-slate-400 sm:w-14 sm:text-xs sm:text-slate-500">
        {label}
        {hint && <span className="ms-1 text-slate-600">{hint}</span>}
      </span>
      <div className="flex items-center gap-2 sm:gap-1.5">
        <button
          type="button"
          onClick={onDecrement}
          disabled={value <= 0}
          className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-800 text-base font-bold text-slate-300 hover:bg-slate-700 disabled:opacity-30 sm:h-7 sm:w-7 sm:rounded sm:text-sm"
        >
          −
        </button>
        <span className="w-6 text-center text-base font-semibold text-slate-100 sm:text-sm">{value}</span>
        <button
          type="button"
          onClick={onIncrement}
          disabled={incrementDisabled}
          className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-800 text-base font-bold text-slate-300 hover:bg-slate-700 disabled:opacity-30 sm:h-7 sm:w-7 sm:rounded sm:text-sm"
        >
          +
        </button>
      </div>
    </div>
  );
}

function StartingStackControl({ startingStack, onSetStartingStack }) {
  const { t } = useLanguage();
  const [value, setValue] = useState(startingStack);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    setValue(startingStack);
  }, [startingStack]);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await onSetStartingStack(value);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg bg-slate-950 px-3 py-2 text-sm text-slate-400">
      <label htmlFor="startingStack" className="whitespace-nowrap">
        {t("player.chipsPerBuyIn")}
      </label>
      <input
        id="startingStack"
        type="number"
        min="1"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="w-24 rounded-lg border border-slate-700 bg-slate-900 px-2 py-2 text-slate-100 outline-none focus:border-emerald-500"
      />
      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="rounded-lg bg-slate-800 px-3 py-2 text-sm font-semibold text-slate-100 hover:bg-slate-700 disabled:opacity-50"
      >
        {saving ? t("common.saving") : t("player.set")}
      </button>
      {error && <span className="text-red-400">{error}</span>}
    </div>
  );
}

export function PlayerManager({
  players,
  playerDirectory,
  startingStack,
  allowRebuys,
  rebuyLimitType,
  maxRebuysPerPlayer,
  allowAddOn,
  onSetStartingStack,
  onAddPlayer,
  onRemovePlayer,
  onEliminatePlayer,
  onReinstatePlayer,
  onRecordBuyIn,
  onUndoBuyIn,
  onRecordRebuy,
  onUndoRebuy,
  onRecordAddOn,
  onUndoAddOn,
}) {
  const { t, locale } = useLanguage();
  const [namedMode, setNamedMode] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState(null);

  async function handleAddNamed(event) {
    event.preventDefault();
    try {
      await onAddPlayer(name);
      setName("");
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleQuickAdd() {
    try {
      await onAddPlayer();
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  }

  function handleDelete(player) {
    if (window.confirm(t("player.deleteConfirm", { name: player.name }))) {
      onRemovePlayer(player.id);
    }
  }

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 sm:p-5">
      <h2 className="mb-4 text-lg font-semibold text-slate-100">{t("player.heading")}</h2>

      <StartingStackControl startingStack={startingStack} onSetStartingStack={onSetStartingStack} />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <button
          type="button"
          onClick={handleQuickAdd}
          className="w-full rounded-lg bg-emerald-600 px-4 py-3 text-base font-bold text-white hover:bg-emerald-500 sm:w-auto sm:py-2 sm:text-sm sm:font-semibold"
        >
          {t("player.quickAdd")}
        </button>
        <button
          type="button"
          onClick={() => setNamedMode((v) => !v)}
          className="text-sm text-slate-500 hover:text-slate-300"
        >
          {namedMode ? t("player.cancelNamedAdd") : t("player.addWithName")}
        </button>
      </div>

      {namedMode && (
        <form onSubmit={handleAddNamed} className="mb-4 flex gap-2">
          <input
            type="text"
            placeholder={t("player.namePlaceholder")}
            autoFocus
            list="player-directory-options"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-3 text-slate-100 outline-none focus:border-emerald-500 sm:py-2"
          />
          {playerDirectory && playerDirectory.length > 0 && (
            <datalist id="player-directory-options">
              {playerDirectory.map((directoryName) => (
                <option key={directoryName} value={directoryName} />
              ))}
            </datalist>
          )}
          <button
            type="submit"
            className="rounded-lg bg-slate-800 px-4 py-3 text-sm font-semibold text-slate-100 hover:bg-slate-700 sm:py-2"
          >
            {t("common.add")}
          </button>
        </form>
      )}

      {error && <p className="mb-3 text-sm text-red-400">{error}</p>}

      {players.length === 0 ? (
        <p className="text-sm text-slate-500">{t("player.noneYet")}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {players.map((player) => {
            const isOut = player.status === "eliminated";
            return (
              <li
                key={player.id}
                className={`flex flex-col gap-3 rounded-lg border px-4 py-3 ${
                  isOut ? "border-slate-800 bg-slate-950/50 opacity-60" : "border-slate-800 bg-slate-950"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className={`font-semibold ${isOut ? "text-slate-500 line-through" : "text-slate-100"}`}>
                      {player.name}
                    </span>
                    {isOut && (
                      <span className="rounded-full bg-red-900/60 px-2 py-0.5 text-xs font-semibold uppercase text-red-300">
                        {t("player.eliminatedBadge")}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-slate-500">
                    {t("player.stackApprox", {
                      amount: formatChips((player.buyIns + player.rebuys + player.addOns) * startingStack, locale),
                    })}
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-row sm:items-center sm:gap-4">
                  <Counter
                    label={t("player.buyIn")}
                    value={player.buyIns}
                    onIncrement={() => onRecordBuyIn(player.id)}
                    onDecrement={() => onUndoBuyIn(player.id)}
                  />
                  {allowRebuys && (
                    <Counter
                      label={t("player.rebuy")}
                      value={player.rebuys}
                      hint={rebuyLimitType === "limited" ? `/${maxRebuysPerPlayer}` : null}
                      incrementDisabled={rebuyLimitType === "limited" && player.rebuys >= maxRebuysPerPlayer}
                      onIncrement={() => onRecordRebuy(player.id)}
                      onDecrement={() => onUndoRebuy(player.id)}
                    />
                  )}
                  {allowAddOn && (
                    <Counter
                      label={t("player.addOn")}
                      value={player.addOns}
                      onIncrement={() => onRecordAddOn(player.id)}
                      onDecrement={() => onUndoAddOn(player.id)}
                    />
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 sm:flex sm:w-auto">
                  {isOut ? (
                    <button
                      type="button"
                      onClick={() => onReinstatePlayer(player.id)}
                      className="rounded-lg bg-slate-800 px-3 py-2.5 text-sm font-semibold text-emerald-400 hover:bg-slate-700 sm:py-1.5"
                    >
                      {t("player.reinstate")}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onEliminatePlayer(player.id)}
                      className="rounded-lg bg-slate-800 px-3 py-2.5 text-sm font-semibold text-amber-400 hover:bg-slate-700 sm:py-1.5"
                    >
                      {t("player.eliminate")}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleDelete(player)}
                    className="rounded-lg bg-slate-800 px-3 py-2.5 text-sm font-semibold text-red-400 hover:bg-slate-700 sm:py-1.5"
                  >
                    {t("common.delete")}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
