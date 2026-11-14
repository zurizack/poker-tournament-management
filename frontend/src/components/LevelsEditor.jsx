import { useEffect, useState } from "react";

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

// Shared row-editing table for a blind structure, used by both the live
// StructureEditor (editing a running tournament's clock) and TemplateManager
// (editing a saved blueprint) — same inputs, same add/remove behavior.
export function LevelsEditor({ levels, disabled, onChange }) {
  const [rows, setRows] = useState(() => levels.map(toRow));

  useEffect(() => {
    setRows(levels.map(toRow));
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
  }

  return (
    <div>
      <p className="mb-3 text-xs text-slate-500 sm:hidden">Swipe the table sideways to see every column.</p>

      <div className="mb-4 overflow-x-auto">
        <table className="w-full min-w-[480px] text-sm">
          <thead>
            <tr className="text-left text-slate-500">
              <th className="px-2 py-1">#</th>
              <th className="px-2 py-1">Small Blind</th>
              <th className="px-2 py-1">Big Blind</th>
              <th className="px-2 py-1">Ante</th>
              <th className="px-2 py-1">Minutes</th>
              <th className="px-2 py-1">Break</th>
              <th className="px-2 py-1" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={index} className="border-t border-slate-800">
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
          + Add Level
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={addBreak}
          className="rounded-lg bg-slate-800 px-4 py-3 text-sm font-semibold text-amber-300 hover:bg-slate-700 disabled:opacity-40 sm:py-2"
        >
          + Add Break
        </button>
      </div>
    </div>
  );
}
