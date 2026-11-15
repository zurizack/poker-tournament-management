import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../lib/api";
import { LevelsEditor } from "../../components/LevelsEditor";

// Matches TemplateManager's starter level so a from-scratch Setup looks the
// same as a from-scratch Template.
const STARTER_LEVELS = [{ smallBlind: 25, bigBlind: 50, ante: 0, durationSeconds: 900, isBreak: false }];

export function TournamentSetupPage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const templateId = searchParams.get("templateId");

  const [name, setName] = useState("");
  const [startingStack, setStartingStack] = useState(1000);
  const [levels, setLevels] = useState(STARTER_LEVELS);
  const [allowRebuys, setAllowRebuys] = useState(true);
  const [rebuyLimitType, setRebuyLimitType] = useState("unlimited");
  const [maxRebuysPerPlayer, setMaxRebuysPerPlayer] = useState(2);
  const [allowAddOn, setAllowAddOn] = useState(true);

  const [loadingTemplate, setLoadingTemplate] = useState(Boolean(templateId));
  const [error, setError] = useState(null);
  const [launching, setLaunching] = useState(false);

  useEffect(() => {
    if (!templateId) return;
    api
      .listTemplates(token)
      .then((data) => {
        const template = data.templates.find((t) => t.templateId === templateId);
        if (!template) {
          setError("That template couldn't be found — it may have been deleted.");
          return;
        }
        setName(template.name);
        setStartingStack(template.startingStack);
        setLevels(template.levels);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoadingTemplate(false));
  }, [templateId, token]);

  async function handleLaunch() {
    setError(null);
    if (rebuyLimitType === "limited" && !(Number(maxRebuysPerPlayer) > 0)) {
      setError("Enter a positive max re-buys per player, or switch to Unlimited.");
      return;
    }

    setLaunching(true);
    try {
      const { tournamentId } = await api.createTournament(token, {
        templateId: templateId || undefined,
        name,
        levels,
        startingStack: Number(startingStack),
        allowRebuys,
        rebuyLimitType,
        maxRebuysPerPlayer: rebuyLimitType === "limited" ? Number(maxRebuysPerPlayer) : null,
        allowAddOn,
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
        <h1 className="mb-6 mt-2 text-2xl font-bold">Set Up Tournament</h1>

        {error && <p className="mb-4 text-sm text-red-400">{error}</p>}

        <div className="mb-6 rounded-xl border border-slate-800 bg-slate-900 p-4 sm:p-5">
          <h2 className="mb-4 text-lg font-semibold text-slate-100">Basics</h2>
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              type="text"
              placeholder="Tournament name (optional)"
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

        <button
          type="button"
          disabled={launching}
          onClick={handleLaunch}
          className="w-full rounded-lg bg-emerald-600 px-4 py-3 text-base font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
        >
          {launching ? "Launching..." : "Launch Tournament"}
        </button>
      </div>
    </div>
  );
}
