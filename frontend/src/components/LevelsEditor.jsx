import { useEffect, useState } from "react";
import { useLanguage } from "../context/LanguageContext";

function toRow(level) {
  return {
    smallBlind: level.smallBlind,
    bigBlind: level.bigBlind,
    ante: level.ante,
    durationMinutes: Math.round(level.durationSeconds / 60),
    isBreak: level.isBreak,
  };
}

function toLevelPayload(row) {
  return {
    smallBlind: Number(row.smallBlind) || 0,
    bigBlind: Number(row.bigBlind) || 0,
    ante: Number(row.ante) || 0,
    durationSeconds: Math.max(1, Number(row.durationMinutes) || 1) * 60,
    isBreak: row.isBreak,
  };
}

// Shared row-editing table for a blind structure, used by both
// TournamentSetupPage (configuring a tournament before launch) and
// TemplateManager (editing a saved blueprint) — same inputs, same
// add/remove behavior. Also supports selecting a subset of rows and
// bulk-setting their duration in one action (e.g. "set these 4 levels to
// 12 minutes each") rather than editing each row's Minutes field one at a time.
export function LevelsEditor({ levels, disabled, onChange }) {
  const { t } = useLanguage();
  const [rows, setRows] = useState(() => levels.map(toRow));
  const [selected, setSelected] = useState(() => new Set());
  const [bulkMinutes, setBulkMinutes] = useState("");

  useEffect(() => {
    setRows(levels.map(toRow));
    setSelected(new Set());
    // Only re-sync when the caller swaps in a different `levels` array
    // (e.g. loading a different template/tournament) — not on every local edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [levels]);

  function emit(nextRows) {
    setRows(nextRows);
    onChange(nextRows.map(toLevelPayload));
  }

  function updateRow(index, field, value) {
    emit(rows.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  }

  function addLevel() {
    emit([...rows, { smallBlind: 0, bigBlind: 0, ante: 0, durationMinutes: 15, isBreak: false }]);
  }

  function addBreak() {
    emit([...rows, { smallBlind: 0, bigBlind: 0, ante: 0, durationMinutes: 10, isBreak: true }]);
  }

  function removeRow(index) {
    emit(rows.filter((_, i) => i !== index));
    // Shift selected indices down past the removed row, drop it if it was selected.
    setSelected((prev) => {
      const next = new Set();
      for (const i of prev) {
        if (i < index) next.add(i);
        else if (i > index) next.add(i - 1);
      }
      return next;
    });
  }

  function toggleSelected(index) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  function selectAll() {
    setSelected(new Set(rows.map((_, i) => i)));
  }

  function deselectAll() {
    setSelected(new Set());
  }

  function applyBulkDuration() {
    const minutes = Math.max(1, Number(bulkMinutes) || 1);
    emit(rows.map((row, i) => (selected.has(i) ? { ...row, durationMinutes: minutes } : row)));
  }

  return (
    <div>
      <p className="mb-3 text-xs text-slate-500 sm:hidden">{t("levels.swipeHint")}</p>

      {!disabled && (
        <div className="mb-2 flex flex-wrap items-center gap-3 text-xs">
          <button type="button" onClick={selectAll} className="text-slate-400 hover:text-slate-200">
            {t("levels.selectAll")}
          </button>
          <button type="button" onClick={deselectAll} className="text-slate-400 hover:text-slate-200">
            {t("levels.deselectAll")}
          </button>
        </div>
      )}

      {!disabled && selected.size > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg bg-slate-800 px-3 py-2">
          <span className="text-sm text-slate-300">{t("levels.selectedCount", { count: selected.size })}</span>
          <input
            type="number"
            min="1"
            placeholder={t("levels.bulkMinutesPlaceholder")}
            value={bulkMinutes}
            onChange={(e) => setBulkMinutes(e.target.value)}
            className="w-20 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-slate-100"
          />
          <button
            type="button"
            onClick={applyBulkDuration}
            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-500"
          >
            {t("levels.applyDuration")}
          </button>
          <button
            type="button"
            onClick={deselectAll}
            className="text-sm text-slate-400 hover:text-slate-200"
          >
            {t("levels.clearSelection")}
          </button>
        </div>
      )}

      <div className="mb-4 overflow-x-auto">
        <table className="w-full min-w-[480px] text-sm">
          <thead>
            <tr className="text-start text-slate-500">
              {!disabled && <th className="px-2 py-1" />}
              <th className="px-2 py-1">#</th>
              <th className="px-2 py-1">{t("levels.colSmallBlind")}</th>
              <th className="px-2 py-1">{t("levels.colBigBlind")}</th>
              <th className="px-2 py-1">{t("levels.colAnte")}</th>
              <th className="px-2 py-1">{t("levels.colMinutes")}</th>
              <th className="px-2 py-1">{t("levels.colBreak")}</th>
              <th className="px-2 py-1" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={index} className="border-t border-slate-800">
                {!disabled && (
                  <td className="px-2 py-2 text-center">
                    <input
                      type="checkbox"
                      checked={selected.has(index)}
                      onChange={() => toggleSelected(index)}
                      className="h-4 w-4"
                    />
                  </td>
                )}
                <td className="px-2 py-2 text-slate-500">{index + 1}</td>
                <td className="px-2 py-2">
                  <input
                    type="number"
                    min="0"
                    disabled={disabled || row.isBreak}
                    value={row.smallBlind}
                    onChange={(e) => updateRow(index, "smallBlind", e.target.value)}
                    className="w-20 rounded border border-slate-700 bg-slate-950 px-2 py-2 text-slate-100 disabled:opacity-40"
                  />
                </td>
                <td className="px-2 py-2">
                  <input
                    type="number"
                    min="0"
                    disabled={disabled || row.isBreak}
                    value={row.bigBlind}
                    onChange={(e) => updateRow(index, "bigBlind", e.target.value)}
                    className="w-20 rounded border border-slate-700 bg-slate-950 px-2 py-2 text-slate-100 disabled:opacity-40"
                  />
                </td>
                <td className="px-2 py-2">
                  <input
                    type="number"
                    min="0"
                    disabled={disabled || row.isBreak}
                    value={row.ante}
                    onChange={(e) => updateRow(index, "ante", e.target.value)}
                    className="w-16 rounded border border-slate-700 bg-slate-950 px-2 py-2 text-slate-100 disabled:opacity-40"
                  />
                </td>
                <td className="px-2 py-2">
                  <input
                    type="number"
                    min="1"
                    disabled={disabled}
                    value={row.durationMinutes}
                    onChange={(e) => updateRow(index, "durationMinutes", e.target.value)}
                    className="w-16 rounded border border-slate-700 bg-slate-950 px-2 py-2 text-slate-100 disabled:opacity-40"
                  />
                </td>
                <td className="px-2 py-2 text-center">
                  <input
                    type="checkbox"
                    disabled={disabled}
                    checked={row.isBreak}
                    onChange={(e) => updateRow(index, "isBreak", e.target.checked)}
                    className="h-5 w-5"
                  />
                </td>
                <td className="px-2 py-2">
                  <button
                    type="button"
                    disabled={disabled || rows.length <= 1}
                    onClick={() => removeRow(index)}
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-800 hover:text-red-400 disabled:opacity-30"
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:flex sm:gap-3">
        <button
          type="button"
          disabled={disabled}
          onClick={addLevel}
          className="rounded-lg bg-slate-800 px-4 py-3 text-sm font-semibold text-slate-100 hover:bg-slate-700 disabled:opacity-40 sm:py-2"
        >
          {t("levels.addLevel")}
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={addBreak}
          className="rounded-lg bg-slate-800 px-4 py-3 text-sm font-semibold text-amber-300 hover:bg-slate-700 disabled:opacity-40 sm:py-2"
        >
          {t("levels.addBreak")}
        </button>
      </div>
    </div>
  );
}
