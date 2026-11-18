import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../lib/api";
import { LevelsEditor } from "../../components/LevelsEditor";

// Single source of truth for both "create from scratch" and "launch/edit an
// existing template" — loading a template just pre-fills this same form.
const STARTER_LEVELS = [{ smallBlind: 25, bigBlind: 50, ante: 0, durationSeconds: 900, isBreak: false }];

export function TournamentSetupPage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // Captured once — the template this form was opened from. `templateId`
  // (below) tracks what the form is *currently* backed by, which changes
  // once "Save as Template" creates a brand-new one.
  const [initialTemplateId] = useState(searchParams.get("templateId"));

  const [name, setName] = useState("");
  const [startingStack, setStartingStack] = useState(1000);
  const [levels, setLevels] = useState(STARTER_LEVELS);
  const [allowRebuys, setAllowRebuys] = useState(true);
  const [rebuyLimitType, setRebuyLimitType] = useState("unlimited");
  const [maxRebuysPerPlayer, setMaxRebuysPerPlayer] = useState(2);
  const [allowAddOn, setAllowAddOn] = useState(true);

  const [templateId, setTemplateId] = useState(initialTemplateId);
  const [loadingTemplate, setLoadingTemplate] = useState(Boolean(initialTemplateId));
  const [error, setError] = useState(null);
  const [statusMessage, setStatusMessage] = useState(null);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [launching, setLaunching] = useState(false);

  useEffect(() => {
    if (!initialTemplateId) return;
    api
      .listTemplates(token)
      .then((data) => {
        const template = data.templates.find((t) => t.templateId === initialTemplateId);
        if (!template) {
          setError("That template couldn't be found — it may have been deleted.");
          return;
        }
        setName(template.name);
        setStartingStack(template.startingStack);
        setLevels(template.levels);
        setAllowRebuys(template.allowRebuys);
        setRebuyLimitType(template.rebuyLimitType);
        setMaxRebuysPerPlayer(template.maxRebuysPerPlayer ?? 2);
        setAllowAddOn(template.allowAddOn);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoadingTemplate(false));
  }, [initialTemplateId, token]);

  function validate() {
    if (!name.trim()) {
      setError("Tournament name is required.");
      return false;
    }
    if (rebuyLimitType === "limited" && !(Number(maxRebuysPerPlayer) > 0)) {
      setError("Enter a positive max re-buys per player, or switch to Unlimited.");
      return false;
    }
    return true;
  }

  function buildConfig() {
    return {
      name,
      levels,
      startingStack: Number(startingStack),
      allowRebuys,
      rebuyLimitType,
      maxRebuysPerPlayer: rebuyLimitType === "limited" ? Number(maxRebuysPerPlayer) : null,
      allowAddOn,
    };
  }

  async function handleSaveTemplate() {
    setError(null);
    setStatusMessage(null);
    if (!validate()) return;

    setSavingTemplate(true);
    try {
      if (templateId) {
        await api.updateTemplate(token, templateId, buildConfig());
      } else {
        const created = await api.createTemplate(token, buildConfig());
        setTemplateId(created.templateId);
      }
      setStatusMessage("Template saved.");
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingTemplate(false);
    }
  }

  async function handleLaunch() {
    setError(null);
    setStatusMessage(null);
    if (!validate()) return;

    setLaunching(true);
    try {
      // templateId is omitted (not forced undefined->null) when there's
      // none yet — the backend auto-saves this configuration as a new
      // quick_launch template in that case.
      const { tournamentId } = await api.createTournament(token, {
        templateId: templateId || undefined,
        ...buildConfig(),
      });
      navigate(`/manager/${tournamentId}`);
    } catch (err) {
      setError(err.message);
      setLaunching(false);
    }
  }

  if (loadingTemplate) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950 text-xl text-slate-500">
        Loading template...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 px-6 py-10 text-slate-100">
      <div className="mx-auto max-w-2xl">
        <Link to="/manager" className="text-sm text-slate-500 hover:text-slate-300">
          ← Dashboard
        </Link>
        <h1 className="mb-6 mt-2 text-2xl font-bold">
          {initialTemplateId ? "Edit & Launch Tournament" : "Set Up Tournament"}
        </h1>

        {error && <p className="mb-4 text-sm text-red-400">{error}</p>}

        <div className="mb-6 rounded-xl border border-slate-800 bg-slate-900 p-4 sm:p-5">
          <h2 className="mb-4 text-lg font-semibold text-slate-100">Basics</h2>
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              type="text"
              placeholder="Tournament name (required), e.g. Friday Night Deepstack"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="flex-1 rounded border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
            />
            <div className="flex items-center gap-2">
              <label htmlFor="startingStack" className="whitespace-nowrap text-sm text-slate-400">
                Starting stack
              </label>
              <input
                id="startingStack"
                type="number"
                min="1"
                value={startingStack}
                onChange={(e) => setStartingStack(e.target.value)}
                className="w-28 rounded border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
              />
            </div>
          </div>
        </div>

        <div className="mb-6 rounded-xl border border-slate-800 bg-slate-900 p-4 sm:p-5">
          <h2 className="mb-4 text-lg font-semibold text-slate-100">Blind Structure</h2>
          <LevelsEditor levels={levels} onChange={setLevels} />
        </div>

        <div className="mb-6 rounded-xl border border-slate-800 bg-slate-900 p-4 sm:p-5">
          <h2 className="mb-4 text-lg font-semibold text-slate-100">Re-buy &amp; Add-on Rules</h2>

          <label className="mb-3 flex items-center gap-3">
            <input
              type="checkbox"
              checked={allowRebuys}
              onChange={(e) => setAllowRebuys(e.target.checked)}
              className="h-5 w-5"
            />
            <span className="text-sm text-slate-200">Allow Re-buys</span>
          </label>

          {allowRebuys && (
            <div className="mb-4 ml-8 flex flex-col gap-2">
              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input
                  type="radio"
                  name="rebuyLimitType"
                  checked={rebuyLimitType === "unlimited"}
                  onChange={() => setRebuyLimitType("unlimited")}
                />
                Unlimited
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input
                  type="radio"
                  name="rebuyLimitType"
                  checked={rebuyLimitType === "limited"}
                  onChange={() => setRebuyLimitType("limited")}
                />
                Limited
              </label>
              {rebuyLimitType === "limited" && (
                <div className="ml-6 flex items-center gap-2">
                  <label htmlFor="maxRebuys" className="text-sm text-slate-400">
                    Max re-buys per player
                  </label>
                  <input
                    id="maxRebuys"
                    type="number"
                    min="1"
                    value={maxRebuysPerPlayer}
                    onChange={(e) => setMaxRebuysPerPlayer(e.target.value)}
                    className="w-20 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-slate-100"
                  />
                </div>
              )}
            </div>
          )}

          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={allowAddOn}
              onChange={(e) => setAllowAddOn(e.target.checked)}
              className="h-5 w-5"
            />
            <span className="text-sm text-slate-200">Allow Add-on</span>
          </label>
        </div>

        {statusMessage && <p className="mb-3 text-center text-sm text-emerald-400">{statusMessage}</p>}

        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            disabled={savingTemplate || !name.trim()}
            onClick={handleSaveTemplate}
            className="flex-1 rounded-lg bg-slate-800 px-4 py-3 text-base font-semibold text-slate-100 hover:bg-slate-700 disabled:opacity-50"
          >
            {savingTemplate ? "Saving..." : templateId ? "Update Template" : "Save as Template"}
          </button>
          <button
            type="button"
            disabled={launching || !name.trim()}
            onClick={handleLaunch}
            className="flex-1 rounded-lg bg-emerald-600 px-4 py-3 text-base font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            {launching ? "Launching..." : "Launch Tournament Now"}
          </button>
        </div>
      </div>
    </div>
  );
}
