import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

export function JoinPage() {
  const [pin, setPin] = useState("");
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  function handleSubmit(event) {
    event.preventDefault();
    const trimmed = pin.trim();
    if (!/^\d{6}$/.test(trimmed)) {
      setError("Enter the 6-digit tournament ID");
      return;
    }
    navigate(`/play/${trimmed}`);
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-6 text-slate-100">
      <div className="w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-900 p-8 shadow-xl">
        <h1 className="mb-1 text-center text-2xl font-bold">Poker Clock</h1>
        <p className="mb-6 text-center text-sm text-slate-400">Enter the tournament ID to join as a player</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            type="text"
            inputMode="numeric"
            placeholder="123456"
            value={pin}
            onChange={(event) => {
              setPin(event.target.value.replace(/\D/g, "").slice(0, 6));
              setError(null);
            }}
            className="rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-center text-2xl tracking-widest text-white outline-none focus:border-emerald-500"
          />
          {error && <p className="text-center text-sm text-red-400">{error}</p>}
          <button
            type="submit"
            className="rounded-lg bg-emerald-600 px-4 py-3 text-base font-semibold text-white transition-colors hover:bg-emerald-500"
          >
            Join Tournament
          </button>
        </form>
      </div>

      <Link to="/manager/login" className="mt-6 text-sm text-slate-500 hover:text-slate-300">
        Tournament manager? Sign in →
      </Link>
    </div>
  );
}
