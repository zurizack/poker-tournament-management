import { useEffect, useState } from "react";
import { useLanguage } from "../context/LanguageContext";
import { api } from "../lib/api";

function AdminRow({ email, onRemove, removeLabel }) {
  return (
    <li className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950 px-3 py-2">
      <span className="text-sm text-slate-200">{email}</span>
      <button
        type="button"
        onClick={onRemove}
        className="rounded-lg bg-slate-800 px-3 py-1 text-xs font-semibold text-red-400 hover:bg-slate-700"
      >
        {removeLabel}
      </button>
    </li>
  );
}

// Owner-only panel for inviting/revoking floor-manager access. Deliberately
// a plain fetch-on-open/after-mutation flow rather than socket-driven — this
// is a low-frequency management action; the gameplay actions an admin takes
// are what need to be live, and those already ride the existing
// tournament:state broadcast with no extra plumbing.
export function AdminManager({ token, tournamentId, onClose }) {
  const { t } = useLanguage();
  const [ownerUsername, setOwnerUsername] = useState(null);
  const [admins, setAdmins] = useState([]);
  const [pendingAdmins, setPendingAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [adding, setAdding] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  function refresh() {
    setLoading(true);
    return api
      .listAdmins(token, tournamentId)
      .then((data) => {
        setOwnerUsername(data.ownerUsername);
        setAdmins(data.admins);
        setPendingAdmins(data.pendingAdmins);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tournamentId]);

  async function handleAdd() {
    setAdding(true);
    setError(null);
    setMessage(null);
    try {
      await api.addAdmin(token, tournamentId, email);
      setEmail("");
      setMessage(t("admin.invitationSent"));
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setAdding(false);
    }
  }

  async function handleRemove(username) {
    setError(null);
    setMessage(null);
    try {
      await api.removeAdmin(token, tournamentId, username);
      await refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="w-full max-w-md rounded-xl border border-slate-800 bg-slate-900 p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-100">{t("admin.title")}</h2>
          <button type="button" onClick={onClose} className="text-slate-500 hover:text-slate-200">
            ✕
          </button>
        </div>

        <p className="mb-3 text-sm text-slate-500">{t("admin.owner", { owner: ownerUsername })}</p>

        {error && <p className="mb-3 text-sm text-red-400">{error}</p>}
        {message && <p className="mb-3 text-sm text-emerald-400">{message}</p>}

        <div className="mb-4 flex gap-2">
          <input
            type="email"
            placeholder="manager@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="flex-1 rounded border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
          />
          <button
            type="button"
            disabled={adding || !email.trim()}
            onClick={handleAdd}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            {adding ? t("admin.inviting") : t("admin.invite")}
          </button>
        </div>

        {loading ? (
          <p className="text-sm text-slate-500">{t("common.loading")}</p>
        ) : (
          <div className="flex flex-col gap-4">
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-amber-400">
                {t("admin.pendingHeader", { count: pendingAdmins.length })}
              </h3>
              {pendingAdmins.length === 0 ? (
                <p className="text-sm text-slate-500">{t("admin.noPending")}</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {pendingAdmins.map((admin) => (
                    <AdminRow
                      key={admin.username}
                      email={admin.email}
                      removeLabel={t("common.cancel")}
                      onRemove={() => handleRemove(admin.username)}
                    />
                  ))}
                </ul>
              )}
            </div>

            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-500">
                {t("admin.activeHeader", { count: admins.length })}
              </h3>
              {admins.length === 0 ? (
                <p className="text-sm text-slate-500">{t("admin.noActive")}</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {admins.map((admin) => (
                    <AdminRow
                      key={admin.username}
                      email={admin.email}
                      removeLabel={t("admin.remove")}
                      onRemove={() => handleRemove(admin.username)}
                    />
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
