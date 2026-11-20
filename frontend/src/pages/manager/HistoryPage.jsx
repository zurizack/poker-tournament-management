import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useLanguage } from "../../context/LanguageContext";
import { api } from "../../lib/api";
import { MirroredGlyph } from "../../components/MirroredGlyph";
import { formatDuration, formatDateTime } from "../../utils/format";

export function HistoryPage() {
  const { token } = useAuth();
  const { t, locale } = useLanguage();
  const navigate = useNavigate();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api
      .listHistory(token)
      .then((data) => setHistory(data.history))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [token]);

  return (
    <div className="min-h-screen bg-slate-950 px-6 py-10 text-slate-100">
      <div className="mx-auto max-w-4xl">
        <Link to="/manager" className="text-sm text-slate-500 hover:text-slate-300">
          <MirroredGlyph>←</MirroredGlyph> {t("nav.dashboard")}
        </Link>
        <h1 className="mb-6 mt-2 text-2xl font-bold">{t("nav.history")}</h1>

        {error && <p className="mb-4 text-sm text-red-400">{error}</p>}

        {loading ? (
          <p className="text-center text-slate-500">{t("history.loading")}</p>
        ) : history.length === 0 ? (
          <p className="text-sm text-slate-500">{t("history.noneYet")}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {history.map((h) => (
              <li key={h.historyId}>
                <button
                  type="button"
                  onClick={() => navigate(`/manager/history/${h.historyId}`)}
                  className="flex w-full items-center justify-between rounded-lg border border-slate-800 bg-slate-900 px-5 py-4 text-start hover:border-emerald-600"
                >
                  <div>
                    <div className="text-lg font-semibold text-slate-100">
                      {h.name || t("common.unnamedTournament")}
                    </div>
                    <div className="text-sm text-slate-500">{formatDateTime(h.endedAt, locale)}</div>
                    <div className="text-sm text-slate-500">
                      {t("history.playedSuffix", { duration: formatDuration(h.activeDurationMs, t) })} ·{" "}
                      {h.uniquePlayers} {h.uniquePlayers === 1 ? t("common.player") : t("common.playersPlural")} ·{" "}
                      {t("history.finalLevel", { level: h.finalLevelIndex + 1 })}
                    </div>
                  </div>
                  <span className="text-slate-500">
                    {t("history.viewReport")} <MirroredGlyph>→</MirroredGlyph>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
