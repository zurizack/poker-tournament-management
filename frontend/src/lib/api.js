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
  createTournament: (token, config) => request("/api/tournaments", { method: "POST", token, body: config }),
  listTournaments: (token) => request("/api/tournaments", { token }),
  endTournament: (token, tournamentId) =>
    request(`/api/tournaments/${tournamentId}/end`, { method: "POST", token }),
  createTemplate: (token, { name, levels, startingStack }) =>
    request("/api/templates", { method: "POST", token, body: { name, levels, startingStack } }),
  listTemplates: (token) => request("/api/templates", { token }),
  updateTemplate: (token, templateId, updates) =>
    request(`/api/templates/${templateId}`, { method: "PUT", token, body: updates }),
  deleteTemplate: (token, templateId) =>
    request(`/api/templates/${templateId}`, { method: "DELETE", token }),
  listAdmins: (token, tournamentId) => request(`/api/tournaments/${tournamentId}/admins`, { token }),
  addAdmin: (token, tournamentId, email) =>
    request(`/api/tournaments/${tournamentId}/admins`, { method: "POST", token, body: { email } }),
  removeAdmin: (token, tournamentId, username) =>
    request(`/api/tournaments/${tournamentId}/admins/${encodeURIComponent(username)}`, {
      method: "DELETE",
      token,
    }),
  acceptInvitation: (token, tournamentId) =>
    request(`/api/tournaments/${tournamentId}/invitations/accept`, { method: "POST", token }),
  declineInvitation: (token, tournamentId) =>
    request(`/api/tournaments/${tournamentId}/invitations/decline`, { method: "POST", token }),
};
