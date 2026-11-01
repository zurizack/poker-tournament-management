// Strip a trailing slash — a pasted-with-trailing-slash env var would
// otherwise double up with the leading "/" on every request path below.
const rawServerUrl = import.meta.env.VITE_SERVER_URL || import.meta.env.VITE_API_URL || "http://localhost:4000";
export const SERVER_URL = rawServerUrl.replace(/\/+$/, "");

async function request(path, { method = "GET", token, body } = {}) {
  const res = await fetch(`${SERVER_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || "Request failed");
  }
  return data;
}

export const api = {
  signup: (username, password) =>
    request("/api/auth/signup", { method: "POST", body: { username, password } }),
  login: (username, password) =>
    request("/api/auth/login", { method: "POST", body: { username, password } }),
  createTournament: (token) => request("/api/tournaments", { method: "POST", token }),
  listTournaments: (token) => request("/api/tournaments", { token }),
};
