import { useLanguage } from "../context/LanguageContext";
import { formatChips } from "../utils/format";

// Read-only — fed directly by a server-computed `prize` object
// ({ totalPrizePool, paidPlaces, payouts }), either the live
// state.prize broadcast over Socket.IO or a TournamentHistory's frozen
// finalPrizePool/finalPayouts snapshot. No math happens here.
export function PrizePayoutTable({ prize, compact = false }) {
  const { t, locale } = useLanguage();

  if (!prize || prize.paidPlaces <= 0) {
    return compact ? null : <p className="text-sm text-slate-500">{t("prize.noPayoutsYet")}</p>;
  }

  return (
    <div>
      <div className={`mb-3 flex flex-wrap items-center gap-4 ${compact ? "text-sm" : "text-base"} text-slate-400`}>
        <div>
          {t("prize.tableTotalPrizePool")}{" "}
          <span className="font-semibold text-slate-100">{formatChips(prize.totalPrizePool, locale)}</span>
        </div>
        <div>
          {t("prize.tablePaidPlaces")} <span className="font-semibold text-slate-100">{prize.paidPlaces}</span>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[280px] text-sm">
          <thead>
            <tr className="text-start text-slate-500">
              <th className="px-2 py-1">{t("prize.tablePlaceCol")}</th>
              <th className="px-2 py-1">{t("prize.tablePercentCol")}</th>
              <th className="px-2 py-1">{t("prize.tableAmountCol")}</th>
            </tr>
          </thead>
          <tbody>
            {prize.payouts.map((row) => (
              <tr key={row.place} className="border-t border-slate-800">
                <td className="px-2 py-2 text-slate-300">#{row.place}</td>
                <td className="px-2 py-2 text-slate-300">{row.percent}%</td>
                <td className="px-2 py-2 font-semibold text-slate-100">{formatChips(row.amount, locale)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
