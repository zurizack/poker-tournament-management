import { useEffect } from "react";
import { useLanguage } from "../context/LanguageContext";

const FIELD = "w-32 rounded border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 disabled:opacity-40";
const SMALL_FIELD = "w-20 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-slate-100 disabled:opacity-40";

// Shared prize-pool configuration form, used by both TournamentSetupPage
// (pre-launch — amounts/ITM-mode/payout-mode only, no live table) and the
// Live Manager's Prize Pool tab (same fields plus a computed table rendered
// alongside it by the caller). `paidPlaces`, when known, drives the custom
// percentage row count; `null` means it can't be known yet (percentage-of-
// field ITM mode before any entries exist) and the row editor is hidden in
// favor of an explanatory note instead.
export function PrizeConfigEditor({ config, onChange, paidPlaces = null, disabled = false }) {
  const { t } = useLanguage();

  // Resizes customPayouts to match the current paidPlaces count without
  // wiping values already typed for places that still exist — missing
  // trailing slots default to 0, extra trailing slots are dropped. Mirrors
  // prizePool.resolvePayoutPercentages on the backend.
  useEffect(() => {
    if (config.payoutMode !== "custom" || paidPlaces == null) return;
    if (config.customPayouts.length === paidPlaces) return;
    const resized = Array.from({ length: paidPlaces }, (_, i) => config.customPayouts[i] ?? 0);
    onChange({ ...config, customPayouts: resized });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paidPlaces, config.payoutMode]);

  function set(field, value) {
    onChange({ ...config, [field]: value });
  }

  function setCustomPayout(index, value) {
    const next = [...config.customPayouts];
    next[index] = value;
    set("customPayouts", next);
  }

  const customSum = config.customPayouts.reduce((sum, p) => sum + (Number(p) || 0), 0);
  const customSumRounded = Math.round(customSum * 100) / 100;
  const customSumOk = Math.abs(customSumRounded - 100) < 0.01;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h3 className="mb-3 text-sm font-semibold text-slate-300">{t("prize.amountsHeading")}</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label className="flex flex-col gap-1 text-sm text-slate-400">
            {t("prize.buyInAmountLabel")}
            <input
              type="number"
              min="0"
              disabled={disabled}
              value={config.buyInAmount}
              onChange={(e) => set("buyInAmount", e.target.value)}
              className={FIELD}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-slate-400">
            {t("prize.rebuyAmountLabel")}
            <input
              type="number"
              min="0"
              disabled={disabled}
              value={config.rebuyAmount}
              onChange={(e) => set("rebuyAmount", e.target.value)}
              className={FIELD}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-slate-400">
            {t("prize.addOnAmountLabel")}
            <input
              type="number"
              min="0"
              disabled={disabled}
              value={config.addOnAmount}
              onChange={(e) => set("addOnAmount", e.target.value)}
              className={FIELD}
            />
          </label>
        </div>

        <label className="mt-4 flex items-center gap-3">
          <input
            type="checkbox"
            disabled={disabled}
            checked={config.manualPrizePoolEnabled}
            onChange={(e) => set("manualPrizePoolEnabled", e.target.checked)}
            className="h-5 w-5"
          />
          <span className="text-sm text-slate-200">{t("prize.manualOverrideLabel")}</span>
        </label>
        {config.manualPrizePoolEnabled ? (
          <label className="mt-2 ms-8 flex flex-col gap-1 text-sm text-slate-400">
            {t("prize.manualAmountLabel")}
            <input
              type="number"
              min="0"
              disabled={disabled}
              value={config.manualPrizePoolAmount}
              onChange={(e) => set("manualPrizePoolAmount", e.target.value)}
              className={FIELD}
            />
          </label>
        ) : (
          <p className="mt-2 ms-8 text-xs text-slate-500">{t("prize.calculatedNote")}</p>
        )}
      </div>

      <div>
        <h3 className="mb-3 text-sm font-semibold text-slate-300">{t("prize.itmHeading")}</h3>
        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input
              type="radio"
              name="itmMode"
              disabled={disabled}
              checked={config.itmMode === "percentage"}
              onChange={() => set("itmMode", "percentage")}
            />
            {t("prize.itmModePercentage")}
          </label>
          {config.itmMode === "percentage" && (
            <div className="ms-6 flex items-center gap-2">
              <input
                type="number"
                min="1"
                max="100"
                disabled={disabled}
                value={config.itmPercent}
                onChange={(e) => set("itmPercent", e.target.value)}
                className={SMALL_FIELD}
              />
              <span className="text-sm text-slate-400">%</span>
            </div>
          )}
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input
              type="radio"
              name="itmMode"
              disabled={disabled}
              checked={config.itmMode === "fixed"}
              onChange={() => set("itmMode", "fixed")}
            />
            {t("prize.itmModeFixed")}
          </label>
          {config.itmMode === "fixed" && (
            <div className="ms-6">
              <input
                type="number"
                min="1"
                disabled={disabled}
                value={config.itmFixedPlaces}
                onChange={(e) => set("itmFixedPlaces", e.target.value)}
                className={SMALL_FIELD}
              />
            </div>
          )}
        </div>
      </div>

      <div>
        <h3 className="mb-3 text-sm font-semibold text-slate-300">{t("prize.payoutHeading")}</h3>
        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input
              type="radio"
              name="payoutMode"
              disabled={disabled}
              checked={config.payoutMode === "formula"}
              onChange={() => set("payoutMode", "formula")}
            />
            {t("prize.payoutModeFormula")}
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input
              type="radio"
              name="payoutMode"
              disabled={disabled}
              checked={config.payoutMode === "custom"}
              onChange={() => set("payoutMode", "custom")}
            />
            {t("prize.payoutModeCustom")}
          </label>
        </div>

        {config.payoutMode === "custom" &&
          (paidPlaces == null ? (
            <p className="mt-3 text-sm text-slate-500">{t("prize.customPercentNeedsLiveNote")}</p>
          ) : (
            <div className="mt-3 flex flex-col gap-2">
              {Array.from({ length: paidPlaces }).map((_, index) => (
                <div key={index} className="flex items-center gap-2">
                  <span className="w-20 text-sm text-slate-400">{t("prize.placeLabel", { place: index + 1 })}</span>
                  <input
                    type="number"
                    min="0"
                    disabled={disabled}
                    value={config.customPayouts[index] ?? 0}
                    onChange={(e) => setCustomPayout(index, e.target.value)}
                    className={SMALL_FIELD}
                  />
                  <span className="text-sm text-slate-400">%</span>
                </div>
              ))}
              <p className={`text-sm font-semibold ${customSumOk ? "text-emerald-400" : "text-amber-400"}`}>
                {customSumOk ? t("prize.totalOk") : t("prize.totalMismatch", { total: customSumRounded })}
              </p>
            </div>
          ))}
      </div>
    </div>
  );
}
