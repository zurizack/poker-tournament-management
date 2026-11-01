import { createContext, useContext, useEffect, useState } from "react";
import { api } from "../lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(() => {
    const token = localStorage.getItem("managerToken");
    const username = localStorage.getItem("managerUsername");
    return token && username ? { token, username } : null;
  });

  useEffect(() => {
    if (auth) {
      localStorage.setItem("managerToken", auth.token);
      localStorage.setItem("managerUsername", auth.username);
    } else {
      localStorage.removeItem("managerToken");
      localStorage.removeItem("managerUsername");
    }
  }, [auth]);

  async function login(username, password) {
    const { token } = await api.login(username, password);
    setAuth({ token, username });
  }

  async function signup(username, password) {
    const { token } = await api.signup(username, password);
    setAuth({ token, username });
  }

  // Used by the Google OAuth callback page, which already has a signed
  // token/username pair from the backend redirect.
  function loginWithToken(token, username) {
    setAuth({ token, username });
  }

  function logout() {
    setAuth(null);
  }

  return (
    <AuthContext.Provider
      value={{
        token: auth?.token ?? null,
        username: auth?.username ?? null,
        isAuthenticated: Boolean(auth),
        login,
        signup,
        loginWithToken,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
