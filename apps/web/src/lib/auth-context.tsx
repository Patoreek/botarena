"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { User } from "@repo/shared";
import { apiFetch } from "@/lib/api";

type AuthState = {
  user: User | null;
  accessToken: string | null;
  loading: boolean;
  error: string | null;
};

type AuthContextValue = AuthState & {
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name?: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  setAccessToken: (token: string | null) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

/** Call our Next.js API routes (same-origin). Cookie is set in the response, so no cross-origin cookie issues. */
async function authFetch<T>(
  path: string,
  options: RequestInit & { body?: object } = {}
): Promise<T> {
  const { body, ...rest } = options;
  const res = await fetch(path, {
    ...rest,
    method: rest.method ?? (body ? "POST" : "GET"),
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      ...rest.headers,
    },
    body: body ? JSON.stringify(body) : rest.body,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error ?? res.statusText);
  }
  return data as T;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    accessToken: null,
    loading: true,
    error: null,
  });

  const refresh = useCallback(async () => {
    try {
      const data = await authFetch<{ accessToken?: string }>("/api/auth/refresh", {
        method: "POST",
      });
      const accessToken = data.accessToken ?? null;
      if (!accessToken) {
        setState((s) => ({ ...s, user: null, accessToken: null, loading: false, error: null }));
        return;
      }
      const user = await apiFetch<User>("/me", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      setState((s) => ({ ...s, user, accessToken, loading: false, error: null }));
    } catch {
      setState((s) => ({ ...s, user: null, accessToken: null, loading: false, error: null }));
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = useCallback(async (email: string, password: string) => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await authFetch<{ user: User; accessToken: string }>("/api/auth/login", {
        body: { email, password },
      });
      setState((s) => ({
        ...s,
        user: data.user,
        accessToken: data.accessToken,
        loading: false,
        error: null,
      }));
      window.location.href = "/dashboard";
    } catch (e) {
      setState((s) => ({
        ...s,
        loading: false,
        error: e instanceof Error ? e.message : "Login failed",
      }));
      throw e;
    }
  }, []);

  const signup = useCallback(async (email: string, password: string, name?: string) => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await authFetch<{ user: User; accessToken: string }>("/api/auth/signup", {
        body: { email, password, name: name?.trim() || undefined },
      });
      setState((s) => ({
        ...s,
        user: data.user,
        accessToken: data.accessToken,
        loading: false,
        error: null,
      }));
      window.location.href = "/dashboard";
    } catch (e) {
      setState((s) => ({
        ...s,
        loading: false,
        error: e instanceof Error ? e.message : "Signup failed",
      }));
      throw e;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await authFetch("/api/auth/logout", { method: "POST" });
    } finally {
      setState({ user: null, accessToken: null, loading: false, error: null });
    }
  }, []);

  const setAccessToken = useCallback((token: string | null) => {
    setState((s) => ({ ...s, accessToken: token }));
  }, []);

  const value: AuthContextValue = {
    ...state,
    login,
    signup,
    logout,
    refresh,
    setAccessToken,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
