import { useEffect, useState } from "react";
import { api } from "../lib/api";

// Plain list only — creating/editing a template happens in the unified
// TournamentSetupPage form (via onOpen), not here, so there's exactly one
// place that knows how to build a tournament/template configuration.
export function TemplateManager({ token, username, onOpen }) {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api
      .listTemplates(token)
      .then((data) => setTemplates(data.templates))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [token]);

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

  return (
    <div className="mb-8 rounded-xl border border-slate-800 bg-slate-900 p-4 sm:p-5">
      <h2 className="mb-4 text-lg font-semibold text-slate-100">Templates</h2>

      {error && <p className="mb-3 text-sm text-red-400">{error}</p>}

      {loading ? (
        <p className="text-sm text-slate-500">Loading templates...</p>
      ) : templates.length === 0 ? (
        <p className="text-sm text-slate-500">
          No templates yet. Use "Save as Template" when setting up a tournament to reuse it later.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {templates.map((t) => (
            <li
              key={t.templateId}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-950 px-4 py-3"
            >
              <div>
                <div className="font-semibold text-slate-100">
                  {t.name}
                  {t.ownerUsername === username ? (
                    <span className="ml-2 rounded bg-emerald-900/60 px-1.5 py-0.5 text-[10px] font-normal uppercase tracking-wide text-emerald-300">
                      Created by me
                    </span>
                  ) : (
                    <span className="ml-2 rounded bg-sky-900/60 px-1.5 py-0.5 text-[10px] font-normal uppercase tracking-wide text-sky-300">
                      Shared / Floor
                    </span>
                  )}
                  {t.source === "quick_launch" && (
                    <span className="ml-2 rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-normal uppercase tracking-wide text-slate-400">
                      auto-saved
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-500">
                  {t.levels.length} level{t.levels.length === 1 ? "" : "s"} · {t.startingStack} starting stack
                  {t.ownerUsername !== username && <span> · owned by {t.ownerUsername}</span>}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => onOpen(t.templateId)}
                  className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
                >
                  Use Template
                </button>
                {t.ownerUsername === username && (
                  <button
                    type="button"
                    onClick={() => handleDelete(t.templateId)}
                    className="rounded-lg bg-slate-800 px-3 py-2 text-sm font-semibold text-red-400 hover:bg-slate-700"
                  >
                    Delete
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
