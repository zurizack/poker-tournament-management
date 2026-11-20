import { useEffect, useState } from "react";
import { useLanguage } from "../context/LanguageContext";
import { api } from "../lib/api";
import { formatChips } from "../utils/format";

// Plain list only — creating/editing a template happens in the unified
// TournamentSetupPage form (via onOpen), not here, so there's exactly one
// place that knows how to build a tournament/template configuration.
export function TemplateManager({ token, username, onOpen }) {
  const { t, locale } = useLanguage();
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
    if (!window.confirm(t("templates.deleteConfirm"))) return;
    setError(null);
    try {
      await api.deleteTemplate(token, templateId);
      setTemplates((prev) => prev.filter((tpl) => tpl.templateId !== templateId));
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="mb-8 rounded-xl border border-slate-800 bg-slate-900 p-4 sm:p-5">
      <h2 className="mb-4 text-lg font-semibold text-slate-100">{t("templates.heading")}</h2>

      {error && <p className="mb-3 text-sm text-red-400">{error}</p>}

      {loading ? (
        <p className="text-sm text-slate-500">{t("templates.loading")}</p>
      ) : templates.length === 0 ? (
        <p className="text-sm text-slate-500">{t("templates.noneYet")}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {templates.map((tpl) => (
            <li
              key={tpl.templateId}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-950 px-4 py-3"
            >
              <div>
                <div className="font-semibold text-slate-100">
                  {tpl.name}
                  {tpl.ownerUsername === username ? (
                    <span className="ms-2 rounded bg-emerald-900/60 px-1.5 py-0.5 text-[10px] font-normal uppercase tracking-wide text-emerald-300">
                      {t("templates.createdByMe")}
                    </span>
                  ) : (
                    <span className="ms-2 rounded bg-sky-900/60 px-1.5 py-0.5 text-[10px] font-normal uppercase tracking-wide text-sky-300">
                      {t("templates.sharedFloor")}
                    </span>
                  )}
                  {tpl.source === "quick_launch" && (
                    <span className="ms-2 rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-normal uppercase tracking-wide text-slate-400">
                      {t("templates.autoSaved")}
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-500">
                  {tpl.levels.length} {tpl.levels.length === 1 ? t("templates.level") : t("templates.levelsPlural")} ·{" "}
                  {formatChips(tpl.startingStack, locale)} {t("templates.startingStackLabel")}
                  {tpl.ownerUsername !== username && (
                    <span> {t("templates.ownedBy", { owner: tpl.ownerUsername })}</span>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => onOpen(tpl.templateId)}
                  className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
                >
                  {t("templates.useTemplate")}
                </button>
                {tpl.ownerUsername === username && (
                  <button
                    type="button"
                    onClick={() => handleDelete(tpl.templateId)}
                    className="rounded-lg bg-slate-800 px-3 py-2 text-sm font-semibold text-red-400 hover:bg-slate-700"
                  >
                    {t("common.delete")}
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
