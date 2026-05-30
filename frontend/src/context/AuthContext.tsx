import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User } from "../types";
import { api, getMe, refreshToken } from "../services/api";

interface AuthContextType {
  user: User | null;
  token: string | null;
  sessionExpiresIn: number | null; // seconds until token expires, null if unknown
  login: (token: string, user: User) => void;
  logout: () => void;
  refreshUser: () => Promise<void>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

const TOKEN_KEY = "bizinsight_token";
const SEVEN_DAYS = 7 * 86400;
const TWO_DAYS   = 2 * 86400;

/** Decode the payload of our HMAC token without verifying (client-side only). */
function decodeTokenExp(token: string): number | null {
  try {
    const [payloadB64] = token.split(".");
    const json = atob(payloadB64.replace(/-/g, "+").replace(/_/g, "/"));
    const payload = JSON.parse(json);
    return typeof payload.exp === "number" ? payload.exp : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionExpiresIn, setSessionExpiresIn] = useState<number | null>(null);

  // ── Update expiry countdown ───────────────────────────────────────────────
  const updateExpiry = (tok: string) => {
    const exp = decodeTokenExp(tok);
    if (exp) setSessionExpiresIn(exp - Math.floor(Date.now() / 1000));
  };

  // ── Bootstrap from localStorage ───────────────────────────────────────────
  useEffect(() => {
    const stored = localStorage.getItem(TOKEN_KEY);
    if (stored) {
      api.defaults.headers.common["Authorization"] = `Bearer ${stored}`;
      setToken(stored);
      updateExpiry(stored);
      getMe()
        .then((res) => setUser(res.data as User))
        .catch(() => {
          localStorage.removeItem(TOKEN_KEY);
          localStorage.removeItem("lastDatasetId");
          delete api.defaults.headers.common["Authorization"];
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Auto-refresh token when < 7 days left; update countdown every minute ─
  useEffect(() => {
    if (!token) return;

    const tick = () => {
      const exp = decodeTokenExp(token);
      if (!exp) return;
      const remaining = exp - Math.floor(Date.now() / 1000);
      setSessionExpiresIn(remaining);

      // Silently refresh when within 7 days of expiry
      if (remaining > 0 && remaining < SEVEN_DAYS) {
        refreshToken()
          .then((res) => {
            const newTok: string = res.data.token;
            localStorage.setItem(TOKEN_KEY, newTok);
            api.defaults.headers.common["Authorization"] = `Bearer ${newTok}`;
            setToken(newTok);
            setSessionExpiresIn(decodeTokenExp(newTok)! - Math.floor(Date.now() / 1000));
          })
          .catch(() => {}); // if refresh fails, existing token is still valid
      }
    };

    tick(); // run immediately
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [token]);

  const login = (newToken: string, newUser: User) => {
    localStorage.setItem(TOKEN_KEY, newToken);
    api.defaults.headers.common["Authorization"] = `Bearer ${newToken}`;
    setToken(newToken);
    setUser(newUser);
    updateExpiry(newToken);
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem("lastDatasetId");
    delete api.defaults.headers.common["Authorization"];
    setToken(null);
    setUser(null);
    setSessionExpiresIn(null);
  };

  const refreshUser = async () => {
    const res = await getMe();
    setUser(res.data as User);
  };

  return (
    <AuthContext.Provider value={{ user, token, sessionExpiresIn, login, logout, refreshUser, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

/** Returns true when the session expires in less than 2 days (for warning banners). */
export function useSessionExpiringSoon(): boolean {
  const { sessionExpiresIn } = useAuth();
  return sessionExpiresIn !== null && sessionExpiresIn > 0 && sessionExpiresIn < TWO_DAYS;
}
