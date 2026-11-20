import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../lib/api";
import { formatDateTime } from "../../utils/format";

const BLANK_FORM = { name: "", nickname: "", phone: "", notes: "" };

function PlayerForm({ form, setForm, onSave, onCancel, saving }) {
  return (
    <div className="mb-4 rounded-lg border border-slate-800 bg-slate-950 p-3 sm:p-4">
      <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <input
          type="text"
          placeholder="Name (required)"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          className="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
        />
        <input
          type="text"
          placeholder="Nickname"
          value={form.nickname}
          onChange={(e) => setForm((f) => ({ ...f, nickname: e.target.value }))}
          className="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
        />
        <input
          type="text"
          placeholder="Phone"
          value={form.phone}
          onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
          className="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
        />
        <input
          type="text"
          placeholder="Notes"
          value={form.notes}
          onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          className="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
        />
      </div>
      <div className="flex gap-3">
        <button
          type="button"
          disabled={saving || !form.name.trim()}
          onClick={onSave}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-100 hover:bg-slate-700"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export function PlayersPage() {
  const { token } = useAuth();
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("lastPlayedAt");
  const [editingId, setEditingId] = useState(null); // null = closed, "new" = creating, else playerId
  const [form, setForm] = useState(BLANK_FORM);
  const [saving, setSaving] = useState(false);

  function refresh() {
    setLoading(true);
    return api
      .listPlayers(token, { search, sort })
      .then((data) => setPlayers(data.players))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, search, sort]);

  function openNew() {
    setForm(BLANK_FORM);
    setEditingId("new");
  }

  function openEdit(player) {
    setForm({
      name: player.name,
      nickname: player.nickname || "",
      phone: player.phone || "",
      notes: player.notes || "",
    });
    setEditingId(player.playerId);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      if (editingId === "new") {
        await api.createPlayer(token, form);
      } else {
        await api.updatePlayer(token, editingId, form);
      }
      setEditingId(null);
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(player) {
    if (!window.confirm(`Remove ${player.name} from the directory?`)) return;
    setError(null);
    try {
      await api.deletePlayer(token, player.playerId);
      setPlayers((prev) => prev.filter((p) => p.playerId !== player.playerId));
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="px-6 py-10">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold">Players</h1>
          {editingId === null && (
            <button
              type="button"
              onClick={openNew}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
            >
              + Add Player
            </button>
          )}
        </div>

        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            type="text"
            placeholder="Search by name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 rounded border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
          />
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
          >
            <option value="lastPlayedAt">Sort: Last played</option>
            <option value="name">Sort: Name</option>
          </select>
        </div>

        {error && <p className="mb-4 text-sm text-red-400">{error}</p>}

        {editingId !== null && (
          <PlayerForm form={form} setForm={setForm} onSave={handleSave} onCancel={() => setEditingId(null)} saving={saving} />
        )}

        {loading ? (
          <p className="text-slate-500">Loading players...</p>
        ) : players.length === 0 ? (
          <p className="text-sm text-slate-500">
            No players yet. They're added automatically when seated in a tournament, or add one manually above.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {players.map((player) => (
              <li
                key={player.playerId}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-900 px-4 py-3"
              >
                <div>
                  <div className="font-semibold text-slate-100">
                    {player.name}
                    {player.nickname && <span className="ml-2 text-slate-500">"{player.nickname}"</span>}
                  </div>
                  <div className="text-xs text-slate-500">
                    {player.tournamentsPlayed} tournament{player.tournamentsPlayed === 1 ? "" : "s"} played · last
                    played {formatDateTime(player.lastPlayedAt)}
                    {player.phone && <span> · {player.phone}</span>}
                  </div>
                  {player.notes && <div className="mt-1 text-xs text-slate-400">{player.notes}</div>}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => openEdit(player)}
                    className="rounded-lg bg-slate-800 px-3 py-2 text-sm font-semibold text-slate-100 hover:bg-slate-700"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(player)}
                    className="rounded-lg bg-slate-800 px-3 py-2 text-sm font-semibold text-red-400 hover:bg-slate-700"
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
