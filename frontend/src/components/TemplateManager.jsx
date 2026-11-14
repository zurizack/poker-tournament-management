import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { LevelsEditor } from "./LevelsEditor";

// A single starter level for a brand-new template — LevelsEditor's
// "+ Add Level"/"+ Add Break" buttons build out the rest.
const STARTER_LEVELS = [{ smallBlind: 25, bigBlind: 50, ante: 0, durationSeconds: 900, isBreak: false }];
const BLANK_FORM = { name: "", startingStack: 1000, levels: STARTER_LEVELS };

export function TemplateManager({ token, onLaunch }) {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingId, setEditingId] = useState(null); // null = closed, "new" = creating
  const [form, setForm] = useState(BLANK_FORM);
  const [saving, setSaving] = useState(false);
  const [launchingId, setLaunchingId] = useState(null);

  useEffect(() => {
    api
      .listTemplates(token)
      .then((data) => setTemplates(data.templates))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [token]);

  function openNew() {
    setForm(BLANK_FORM);
    setEditingId("new");
  }

  function openEdit(template) {
    setForm({ name: template.name, startingStack: template.startingStack, levels: template.levels });
    setEditingId(template.templateId);
  }

  function closeForm() {
    setEditingId(null);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const payload = { name: form.name, levels: form.levels, startingStack: Number(form.startingStack) };
      if (editingId === "new") {
        const created = await api.createTemplate(token, payload);
        setTemplates((prev) => [
          { templateId: created.templateId, name: created.name, levels: created.levels, startingStack: created.startingStack },
          ...prev,
        ]);
      } else {
        const updated = await api.updateTemplate(token, editingId, payload);
        setTemplates((prev) => prev.map((t) => (t.templateId === editingId ? { ...t, ...updated } : t)));
      }
      setEditingId(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(templateId) {
    if (!window.confirm("Delete this template?")) return;
    setError(null);
    try {
      await api.deleteTemplate(token, templateId);
      setTemplates((prev) => prev.filter((t) => t.templateId !== templateId));
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleLaunch(templateId) {
    setLaunchingId(templateId);
    setError(null);
    try {
      await onLaunch(templateId);
    } catch (err) {
      setError(err.message);
      setLaunchingId(null);
    }
  }

  return (
    <div className="mb-8 rounded-xl border border-slate-800 bg-slate-900 p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-100">Templates</h2>
        {editingId === null && (
          <button
            type="button"
            onClick={openNew}
            className="rounded-lg bg-slate-800 px-3 py-2 text-sm font-semibold text-slate-100 hover:bg-slate-700"
          >
            + New Template
          </button>
        )}
      </div>

      {error && <p className="mb-3 text-sm text-red-400">{error}</p>}

      {editingId !== null && (
        <div className="mb-4 rounded-lg border border-slate-800 bg-slate-950 p-3 sm:p-4">
          <div className="mb-3 flex flex-col gap-3 sm:flex-row">
            <input
              type="text"
              placeholder="Template name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="flex-1 rounded border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
            />
            <input
              type="number"
              min="1"
              placeholder="Starting stack"
              value={form.startingStack}
              onChange={(e) => setForm((f) => ({ ...f, startingStack: e.target.value }))}
              className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 sm:w-40"
            />
          </div>

          <LevelsEditor levels={form.levels} onChange={(levels) => setForm((f) => ({ ...f, levels }))} />

          <div className="mt-3 flex gap-3">
            <button
              type="button"
              disabled={saving || !form.name.trim()}
              onClick={handleSave}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Template"}
            </button>
            <button
              type="button"
              onClick={closeForm}
              className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-100 hover:bg-slate-700"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-slate-500">Loading templates...</p>
      ) : templates.length === 0 ? (
        <p className="text-sm text-slate-500">No templates yet. Save a blind structure to reuse it later.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {templates.map((t) => (
            <li
              key={t.templateId}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-950 px-4 py-3"
            >
              <div>
                <div className="font-semibold text-slate-100">{t.name}</div>
                <div className="text-xs text-slate-500">
                  {t.levels.length} level{t.levels.length === 1 ? "" : "s"} · {t.startingStack} starting stack
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={launchingId === t.templateId}
                  onClick={() => handleLaunch(t.templateId)}
                  className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                >
                  {launchingId === t.templateId ? "Launching..." : "Launch"}
                </button>
                <button
                  type="button"
                  onClick={() => openEdit(t)}
                  className="rounded-lg bg-slate-800 px-3 py-2 text-sm font-semibold text-slate-100 hover:bg-slate-700"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(t.templateId)}
                  className="rounded-lg bg-slate-800 px-3 py-2 text-sm font-semibold text-red-400 hover:bg-slate-700"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
