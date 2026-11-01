import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { SERVER_URL } from "../../lib/api";

export function ManagerLoginPage() {
  const [mode, setMode] = useState("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [searchParams] = useSearchParams();
  const [error, setError] = useState(
    searchParams.get("error") === "google_auth_failed" ? "Google sign-in failed. Please try again." : null,
  );
  const [submitting, setSubmitting] = useState(false);
  const { login, signup } = useAuth();
  const navigate = useNavigate();

  function handleGoogleSignIn() {
    window.location.href = `${SERVER_URL}/auth/google`;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (mode === "login") {
        await login(username, password);
      } else {
        await signup(username, password);
      }
      navigate("/manager");
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-6 text-slate-100">
      <div className="w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-900 p-8 shadow-xl">
        <h1 className="mb-1 text-center text-2xl font-bold">
          {mode === "login" ? "Manager Login" : "Create Manager Account"}
        </h1>
        <p className="mb-6 text-center text-sm text-slate-400">Manage tournaments, structures, and players</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-emerald-500"
            autoComplete="username"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-emerald-500"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
          />
          {error && <p className="text-center text-sm text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-emerald-600 px-4 py-3 text-base font-semibold text-white transition-colors hover:bg-emerald-500 disabled:opacity-50"
          >
            {mode === "login" ? "Sign In" : "Sign Up"}
          </button>
        </form>

        <div className="my-5 flex items-center gap-3">
          <div className="h-px flex-1 bg-slate-800" />
          <span className="text-xs uppercase tracking-widest text-slate-600">or</span>
          <div className="h-px flex-1 bg-slate-800" />
        </div>

        <button
          type="button"
          onClick={handleGoogleSignIn}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-sm font-semibold text-slate-100 transition-colors hover:bg-slate-800"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M23.49 12.27c0-.79-.07-1.54-.2-2.27H12v4.3h6.47a5.53 5.53 0 0 1-2.4 3.63v3.02h3.86c2.26-2.09 3.56-5.17 3.56-8.68z"
            />
            <path
              fill="#34A853"
              d="M12 24c3.24 0 5.95-1.07 7.93-2.91l-3.86-3.02c-1.07.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.29v3.12A11.99 11.99 0 0 0 12 24z"
            />
            <path
              fill="#FBBC05"
              d="M5.27 14.26A7.2 7.2 0 0 1 4.89 12c0-.78.14-1.54.38-2.26V6.62H1.29A11.95 11.95 0 0 0 0 12c0 1.94.46 3.77 1.29 5.38z"
            />
            <path
              fill="#EA4335"
              d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42A11.95 11.95 0 0 0 12 0 11.99 11.99 0 0 0 1.29 6.62l3.98 3.12C6.22 6.86 8.87 4.75 12 4.75z"
            />
          </svg>
          Sign in with Google
        </button>

        <button
          type="button"
          onClick={() => {
            setMode(mode === "login" ? "signup" : "login");
            setError(null);
          }}
          className="mt-4 w-full text-center text-sm text-slate-500 hover:text-slate-300"
        >
          {mode === "login" ? "Need an account? Sign up" : "Already have an account? Sign in"}
        </button>
      </div>
    </div>
  );
}
