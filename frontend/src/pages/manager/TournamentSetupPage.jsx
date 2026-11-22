import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useLanguage } from "../../context/LanguageContext";
import { api } from "../../lib/api";
import { LevelsEditor } from "../../components/LevelsEditor";
import { PrizeConfigEditor } from "../../components/PrizeConfigEditor";
import { MirroredGlyph } from "../../components/MirroredGlyph";
import { LanguageToggle } from "../../components/LanguageToggle";

// Single source of truth for both "create from scratch" and "launch/edit an
// existing template" — loading a template just pre-fills this same form.
const STARTER_LEVELS = [{ smallBlind: 25, bigBlind: 50, ante: 0, durationSeconds: 900, isBreak: false }];

// Mirrors backend/src/prizePool.js's DEFAULT_PRIZE_CONFIG (payout structure
// only — buy-in/re-buy/add-on amounts are separate core fields, set below
// alongside startingStack/allowRebuys). Setup has no live tournament yet to
// read defaults from, so a brand-new form seeds here.
const DEFAULT_PRIZE_CONFIG = {
  itmMode: "percentage",
  itmPercent: 15,
  itmFixedPlaces: 3,
  payoutMode: "formula",
  customPayouts: [],
};

export function TournamentSetupPage() {
  const { token, username } = useAuth();
  const { t } = useLanguage();
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
  const [allowAddOn, setAllowAddOn] = useState(false);
  const [buyInAmount, setBuyInAmount] = useState(0);
  const [rebuyAmount, setRebuyAmount] = useState(0);
  const [addOnAmount, setAddOnAmount] = useState(0);
  const [prizeConfig, setPrizeConfig] = useState(DEFAULT_PRIZE_CONFIG);

  const [templateId, setTemplateId] = useState(initialTemplateId);
  // Who owns the currently-loaded template — null until it's fetched (or
  // for a from-scratch form, where it stays null until the first save).
  // Used to tell "mine" from a shared/floor template, below.
  const [templateOwner, setTemplateOwner] = useState(null);
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
        const template = data.templates.find((tpl) => tpl.templateId === initialTemplateId);
        if (!template) {
          setError(t("setup.errTemplateNotFound"));
          return;
        }
        setName(template.name);
        setStartingStack(template.startingStack);
        setLevels(template.levels);
        setAllowRebuys(template.allowRebuys);
        setRebuyLimitType(template.rebuyLimitType);
        setMaxRebuysPerPlayer(template.maxRebuysPerPlayer ?? 2);
        setAllowAddOn(template.allowAddOn);
        setBuyInAmount(template.buyInAmount ?? 0);
        setRebuyAmount(template.rebuyAmount ?? 0);
        setAddOnAmount(template.addOnAmount ?? 0);
        setPrizeConfig({ ...DEFAULT_PRIZE_CONFIG, ...template.prizeConfig });
        setTemplateOwner(template.ownerUsername);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoadingTemplate(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialTemplateId, token]);

  function validate() {
    if (!name.trim()) {
      setError(t("setup.errNameRequired"));
      return false;
    }
    if (rebuyLimitType === "limited" && !(Number(maxRebuysPerPlayer) > 0)) {
      setError(t("setup.errMaxRebuys"));
      return false;
    }
    if (prizeConfig.payoutMode === "custom" && prizeConfig.itmMode === "fixed") {
      const sum = prizeConfig.customPayouts.reduce((total, p) => total + (Number(p) || 0), 0);
      if (prizeConfig.customPayouts.length > 0 && Math.abs(sum - 100) > 0.01) {
        setError(t("prize.totalMismatch", { total: Math.round(sum * 100) / 100 }));
        return false;
      }
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
      buyInAmount: Number(buyInAmount) || 0,
      rebuyAmount: Number(rebuyAmount) || 0,
      addOnAmount: Number(addOnAmount) || 0,
      prizeConfig,
    };
  }

  // Owner-only edits in place; a template shared by another manager (via
  // template admins — see backend templateStore.js) always saves as a new
  // copy under the current user instead, since they can't overwrite it.
  const isSharedTemplate = Boolean(templateId) && templateOwner !== null && templateOwner !== username;

  async function handleSaveTemplate() {
    setError(null);
    setStatusMessage(null);
    if (!validate()) return;

    setSavingTemplate(true);
    try {
      if (templateId && !isSharedTemplate) {
        await api.updateTemplate(token, templateId, buildConfig());
        setStatusMessage(t("setup.templateSaved"));
      } else {
        const created = await api.createTemplate(token, buildConfig());
        setTemplateId(created.templateId);
        setTemplateOwner(created.ownerUsername);
        setStatusMessage(isSharedTemplate ? t("setup.savedAsNewCopy") : t("setup.templateSaved"));
      }
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
        {t("setup.loadingTemplate")}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 px-6 py-10 text-slate-100">
      <div className="mx-auto max-w-2xl">
        <div className="flex items-center justify-between">
          <Link to="/manager" className="text-sm text-slate-500 hover:text-slate-300">
            <MirroredGlyph>←</MirroredGlyph> {t("nav.dashboard")}
          </Link>
          <LanguageToggle />
        </div>
        <h1 className="mb-2 mt-2 text-2xl font-bold">
          {initialTemplateId ? t("setup.titleEdit") : t("setup.titleNew")}
        </h1>
        {isSharedTemplate && (
          <p className="mb-4 text-sm text-sky-400">{t("setup.sharedNotice", { owner: templateOwner })}</p>
        )}
        <div className="mb-4" />

        {error && <p className="mb-4 text-sm text-red-400">{error}</p>}

        <div className="mb-6 rounded-xl border border-slate-800 bg-slate-900 p-4 sm:p-5">
          <h2 className="mb-4 text-lg font-semibold text-slate-100">{t("setup.basics")}</h2>
          <div className="flex flex-col gap-4">
            <input
              type="text"
              placeholder={t("setup.tournamentNamePlaceholder")}
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
            />
            <label htmlFor="startingStack" className="flex flex-col gap-1 text-sm text-slate-400">
              {t("setup.startingStackLabel")}
              <input
                id="startingStack"
                type="number"
                min="1"
                value={startingStack}
                onChange={(e) => setStartingStack(e.target.value)}
                className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
              />
            </label>
            <label htmlFor="buyInAmount" className="flex flex-col gap-1 text-sm text-slate-400">
              {t("prize.buyInAmountLabel")}
              <input
                id="buyInAmount"
                type="number"
                min="0"
                value={buyInAmount}
                onChange={(e) => setBuyInAmount(e.target.value)}
                className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
              />
            </label>
          </div>
        </div>

        <div className="mb-6 rounded-xl border border-slate-800 bg-slate-900 p-4 sm:p-5">
          <h2 className="mb-4 text-lg font-semibold text-slate-100">{t("setup.blindStructure")}</h2>
          <LevelsEditor levels={levels} onChange={setLevels} />
        </div>

        <div className="mb-6 rounded-xl border border-slate-800 bg-slate-900 p-4 sm:p-5">
          <h2 className="mb-4 text-lg font-semibold text-slate-100">{t("setup.rebuyAddOnRules")}</h2>

          <label className="mb-3 flex items-center gap-3">
            <input
              type="checkbox"
              checked={allowRebuys}
              onChange={(e) => setAllowRebuys(e.target.checked)}
              className="h-5 w-5"
            />
            <span className="text-sm text-slate-200">{t("setup.allowRebuys")}</span>
          </label>

          {allowRebuys && (
            <div className="mb-4 ms-8 flex flex-col gap-2">
              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input
                  type="radio"
                  name="rebuyLimitType"
                  checked={rebuyLimitType === "unlimited"}
                  onChange={() => setRebuyLimitType("unlimited")}
                />
                {t("setup.unlimited")}
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input
                  type="radio"
                  name="rebuyLimitType"
                  checked={rebuyLimitType === "limited"}
                  onChange={() => setRebuyLimitType("limited")}
                />
                {t("setup.limited")}
              </label>
              {rebuyLimitType === "limited" && (
                <div className="ms-6 flex items-center gap-2">
                  <label htmlFor="maxRebuys" className="text-sm text-slate-400">
                    {t("setup.maxRebuysPerPlayer")}
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
              <div className="flex items-center gap-2">
                <label htmlFor="rebuyAmount" className="text-sm text-slate-400">
                  {t("prize.rebuyAmountLabel")}
                </label>
                <input
                  id="rebuyAmount"
                  type="number"
                  min="0"
                  value={rebuyAmount}
                  onChange={(e) => setRebuyAmount(e.target.value)}
                  className="w-20 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-slate-100"
                />
              </div>
            </div>
          )}

          <label className="mb-3 flex items-center gap-3">
            <input
              type="checkbox"
              checked={allowAddOn}
              onChange={(e) => setAllowAddOn(e.target.checked)}
              className="h-5 w-5"
            />
            <span className="text-sm text-slate-200">{t("setup.allowAddOn")}</span>
          </label>

          {allowAddOn && (
            <div className="ms-8 flex items-center gap-2">
              <label htmlFor="addOnAmount" className="text-sm text-slate-400">
                {t("prize.addOnAmountLabel")}
              </label>
              <input
                id="addOnAmount"
                type="number"
                min="0"
                value={addOnAmount}
                onChange={(e) => setAddOnAmount(e.target.value)}
                className="w-20 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-slate-100"
              />
            </div>
          )}
        </div>

        <div className="mb-6 rounded-xl border border-slate-800 bg-slate-900 p-4 sm:p-5">
          <h2 className="mb-4 text-lg font-semibold text-slate-100">{t("prize.heading")}</h2>
          <PrizeConfigEditor
            config={prizeConfig}
            onChange={setPrizeConfig}
            paidPlaces={prizeConfig.itmMode === "fixed" ? Number(prizeConfig.itmFixedPlaces) || 0 : null}
          />
        </div>

        {statusMessage && <p className="mb-3 text-center text-sm text-emerald-400">{statusMessage}</p>}

        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            disabled={savingTemplate || !name.trim()}
            onClick={handleSaveTemplate}
            className="flex-1 rounded-lg bg-slate-800 px-4 py-3 text-base font-semibold text-slate-100 hover:bg-slate-700 disabled:opacity-50"
          >
            {savingTemplate
              ? t("common.saving")
              : templateId && !isSharedTemplate
                ? t("setup.updateTemplate")
                : t("setup.saveAsTemplate")}
          </button>
          <button
            type="button"
            disabled={launching || !name.trim()}
            onClick={handleLaunch}
            className="flex-1 rounded-lg bg-emerald-600 px-4 py-3 text-base font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            {launching ? t("setup.launching") : t("setup.launchNow")}
          </button>
        </div>
      </div>
    </div>
  );
}
