"use client";

import React, { createContext, useCallback, useContext, useEffect, useReducer } from "react";
import { useRouter } from "next/navigation";
import { signIn, signOut as authSignOut } from "next-auth/react";
import type { User } from "@repo/shared";
import { authApi } from "@/lib/auth/client";
import { AuthError } from "@/lib/auth/types";

// --- State ---

type AuthState = {
  user: User | null;
  accessToken: string | null;
  loading: boolean;
  error: string | null;
};

type AuthAction =
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "SET_SESSION"; payload: { user: User; accessToken: string } | null }
  | { type: "SET_ACCESS_TOKEN"; payload: string | null }
  | { type: "SET_ERROR"; payload: string | null }
  | { type: "LOGOUT" };

const initialState: AuthState = {
  user: null,
  accessToken: null,
  loading: true,
  error: null,
};

function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case "SET_LOADING":
      return { ...state, loading: action.payload };
    case "SET_SESSION":
      return {
        ...state,
        user: action.payload?.user ?? null,
        accessToken: action.payload?.accessToken ?? null,
        loading: false,
        error: null,
      };
    case "SET_ERROR":
      return { ...state, error: action.payload, loading: false };
    case "SET_ACCESS_TOKEN":
      return {
        ...state,
        accessToken: action.payload,
        ...(action.payload === null ? { user: null } : {}),
      };
    case "LOGOUT":
      return { ...initialState, loading: false };
    default:
      return state;
  }
}

// --- Context ---

type AuthContextValue = AuthState & {
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name?: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  setAccessToken: (token: string | null) => void;
  clearError: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

// --- Provider ---

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [state, dispatch] = useReducer(authReducer, initialState);

  const refresh = useCallback(async () => {
    try {
      const session = await authApi.refresh();
      dispatch({ type: "SET_SESSION", payload: session });
    } catch {
      dispatch({ type: "SET_SESSION", payload: null });
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = useCallback(
    async (email: string, password: string) => {
      dispatch({ type: "SET_LOADING", payload: true });
      dispatch({ type: "SET_ERROR", payload: null });
      try {
        const result = await authApi.login(email, password);
        if (result.oneTimeToken && result.user) {
          await signIn("one-time-token", {
            oneTimeToken: result.oneTimeToken,
            user: JSON.stringify(result.user),
            redirect: false,
          });
        }
        dispatch({
          type: "SET_SESSION",
          payload: { user: result.user, accessToken: result.accessToken },
        });
        router.push("/dashboard");
      } catch (e) {
        const message = e instanceof AuthError ? e.message : "Login failed";
        dispatch({ type: "SET_ERROR", payload: message });
        throw e;
      }
    },
    [router]
  );

  const signup = useCallback(
    async (email: string, password: string, name?: string) => {
      dispatch({ type: "SET_LOADING", payload: true });
      dispatch({ type: "SET_ERROR", payload: null });
      try {
        const result = await authApi.signup(email, password, name);
        if (result.oneTimeToken && result.user) {
          await signIn("one-time-token", {
            oneTimeToken: result.oneTimeToken,
            user: JSON.stringify(result.user),
            redirect: false,
          });
        }
        dispatch({
          type: "SET_SESSION",
          payload: { user: result.user, accessToken: result.accessToken },
        });
        router.push("/dashboard");
      } catch (e) {
        const message = e instanceof AuthError ? e.message : "Signup failed";
        dispatch({ type: "SET_ERROR", payload: message });
        throw e;
      }
    },
    [router]
  );

  const logout = useCallback(async () => {
    try {
      await authSignOut({ redirect: false });
      await authApi.logout();
    } finally {
      dispatch({ type: "LOGOUT" });
    }
  }, []);

  const setAccessToken = useCallback((token: string | null) => {
    dispatch({ type: "SET_ACCESS_TOKEN", payload: token });
  }, []);

  const clearError = useCallback(() => {
    dispatch({ type: "SET_ERROR", payload: null });
  }, []);

  const value: AuthContextValue = {
    ...state,
    login,
    signup,
    logout,
    refresh,
    setAccessToken,
    clearError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
