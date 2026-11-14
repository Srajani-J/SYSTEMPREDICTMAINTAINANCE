import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { apiRequest, getToken, setToken } from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  // Only a stored token can produce a pending session check.
  const [loading, setLoading] = useState(() => Boolean(getToken()));

  // Restore the session once on mount: a stored token is only trusted after
  // the server confirms it is still valid.
  useEffect(() => {
    let cancelled = false;

    if (!getToken()) {
      return () => {
        cancelled = true;
      };
    }

    apiRequest("/api/auth/me")
      .then((profile) => {
        if (!cancelled) {
          setUser(profile);
        }
      })
      .catch(() => {
        setToken("");
        if (!cancelled) {
          setUser(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email, password) => {
    const session = await apiRequest("/api/auth/login", {
      method: "POST",
      auth: false,
      body: { email, password },
    });

    setToken(session.access_token);
    setUser(session.user);

    return session.user;
  }, []);

  const register = useCallback(async (name, email, password) => {
    const session = await apiRequest("/api/auth/register", {
      method: "POST",
      auth: false,
      body: { name, email, password },
    });

    setToken(session.access_token);
    setUser(session.user);

    return session.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiRequest("/api/auth/logout", { method: "POST" });
    } catch {
      // A revoked or expired token still means the local session ends.
    } finally {
      setToken("");
      setUser(null);
    }
  }, []);

  const changePassword = useCallback(async (currentPassword, newPassword) => {
    const session = await apiRequest("/api/auth/change-password", {
      method: "POST",
      body: {
        current_password: currentPassword,
        new_password: newPassword,
      },
    });

    setToken(session.access_token);
    setUser(session.user);

    return session.user;
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      login,
      register,
      logout,
      changePassword,
      isAuthenticated: Boolean(user),
    }),
    [user, loading, login, register, logout, changePassword]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside <AuthProvider>.");
  }

  return context;
}
