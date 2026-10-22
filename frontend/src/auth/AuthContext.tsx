// PROPIETARIO: Persona 5. Versión mínima funcional; P5 puede mejorarla
// pero SIN cambiar la forma de useAuth() (otros la usan).
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api, tokenStore } from "../api/client";
import type { UserPublic } from "../api/types";

interface AuthState {
  user: UserPublic | null;
  loading: boolean;
  login: (usernameOrEmail: string, password: string) => Promise<void>;
  register: (d: { username: string; email: string; password: string; display_name?: string }) => Promise<void>;
  logout: () => void;
  setUser: (u: UserPublic | null) => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserPublic | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tokenStore.get()) {
      setLoading(false);
      return;
    }
    api.me()
      .then(setUser)
      .catch(() => tokenStore.clear())
      .finally(() => setLoading(false));
  }, []);

  const value: AuthState = {
    user,
    loading,
    setUser,
    async login(id, pw) {
      const r = await api.login(id, pw);
      tokenStore.set(r.access_token);
      setUser(r.user);
    },
    async register(d) {
      const r = await api.register(d);
      tokenStore.set(r.access_token);
      setUser(r.user);
    },
    logout() {
      tokenStore.clear();
      setUser(null);
    },
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth fuera de <AuthProvider>");
  return ctx;
}
