import { useEffect } from "react";
import { useLanguage } from "../context/LanguageContext";

// Lets a manager set a distinct price for each re-buy index (1st, 2nd, ...
// Nth) instead of the flat rebuyAmount — e.g. re-buy #1 costs less than
// re-buy #3. Only meaningful alongside limited re-buys, where `count` (the
// configured max re-buys per player) gives a fixed number of slots. `prices`
// is padded/truncated to `count` whenever it changes, mirroring
// PrizeConfigEditor's customPayouts resize pattern, so values already typed
// for indices that still exist aren't wiped out.
export function RebuyPriceEditor({ count, fallbackAmount, enabled, onToggleEnabled, prices, onChangePrices, disabled }) {
  const { t } = useLanguage();

  useEffect(() => {
    if (!enabled || prices.length === count) return;
    const resized = Array.from({ length: count }, (_, i) => prices[i] ?? fallbackAmount);
    onChangePrices(resized);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count, enabled]);

  function setPrice(index, value) {
    const next = [...prices];
    next[index] = value;
    onChangePrices(next);
  }

  return (
    <div>
      <label className="flex items-center gap-3">
        <input
          type="checkbox"
          disabled={disabled}
          checked={enabled}
          onChange={(e) => onToggleEnabled(e.target.checked)}
          className="h-5 w-5"
        />
        <span className="text-sm text-slate-200">{t("setup.customRebuyPrices")}</span>
      </label>
      {enabled && (
        <div className="mt-2 ms-8 flex flex-col gap-2">
          {Array.from({ length: count }).map((_, index) => (
            <div key={index} className="flex items-center gap-2">
              <span className="w-24 text-sm text-slate-400">{t("setup.rebuyIndexLabel", { index: index + 1 })}</span>
              <input
                type="number"
                min="0"
                disabled={disabled}
                value={prices[index] ?? fallbackAmount}
                onChange={(e) => setPrice(index, e.target.value)}
                className="w-20 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-slate-100"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
