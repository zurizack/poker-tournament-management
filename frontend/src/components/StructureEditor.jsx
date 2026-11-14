import { useEffect, useState } from "react";
import { LevelsEditor } from "./LevelsEditor";

export function StructureEditor({ levels, disabled, onSave }) {
  const [pendingLevels, setPendingLevels] = useState(levels);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  // Keep the save payload in sync whenever the server pushes a fresh
  // structure (e.g. another manager tab saved first) — mirrors LevelsEditor's
  // own internal reset so "Save" never submits a stale snapshot.
  useEffect(() => {
    setPendingLevels(levels);
  }, [levels]);

  async function handleSave() {
    setSaving(true);
    setMessage(null);
    try {
      await onSave(pendingLevels);
      setMessage({ type: "success", text: "Structure saved" });
    } catch (err) {
      setMessage({ type: "error", text: err.message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 sm:p-5">
      <h2 className="mb-4 text-lg font-semibold text-slate-100">Blind Structure</h2>

      {disabled && (
        <p className="mb-3 rounded-lg bg-amber-900/40 px-3 py-2 text-sm text-amber-300">
          Pause the clock to edit the structure.
        </p>
      )}

      <LevelsEditor levels={levels} disabled={disabled} onChange={setPendingLevels} />

      <button
        type="button"
        disabled={disabled || saving}
        onClick={handleSave}
        className="mt-3 w-full rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50 sm:ml-auto sm:w-auto sm:py-2"
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
