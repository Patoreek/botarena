"use client";

import type { User } from "@repo/shared";
import { AuthError } from "./types";
import type { AuthResult } from "./types";

const base = ""; // same-origin

async function request<T>(
  path: string,
  options: { method?: string; body?: object } = {}
): Promise<T> {
  const { method = "POST", body } = options;
  const res = await fetch(`${base}${path}`, {
    method,
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = (await res.json().catch(() => ({}))) as { error?: string };

  if (!res.ok) {
    throw new AuthError(data.error ?? res.statusText, res.status);
  }

  return data as T;
}

export const authApi = {
  async login(email: string, password: string): Promise<AuthResult> {
    const data = await request<{ user: User; accessToken: string; oneTimeToken?: string }>(
      "/api/auth/login",
      {
        body: { email, password },
      }
    );
    return { user: data.user, accessToken: data.accessToken, oneTimeToken: data.oneTimeToken };
  },

  async signup(email: string, password: string, name?: string): Promise<AuthResult> {
    const data = await request<{ user: User; accessToken: string; oneTimeToken?: string }>(
      "/api/auth/signup",
      {
        body: { email, password, name: name?.trim() || undefined },
      }
    );
    return { user: data.user, accessToken: data.accessToken, oneTimeToken: data.oneTimeToken };
  },

  async logout(): Promise<void> {
    await request("/api/auth/logout", { method: "POST" });
  },

  async refresh(): Promise<{ user: User; accessToken: string } | null> {
    const data = await request<{ accessToken?: string }>("/api/auth/refresh", {
      method: "POST",
    });
    if (!data.accessToken) return null;
    // Fetch user with the new access token (backend /me)
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
    const meRes = await fetch(`${apiUrl}/me`, {
      headers: { Authorization: `Bearer ${data.accessToken}` },
      credentials: "include",
    });
    if (!meRes.ok) return null;
    const user = (await meRes.json()) as User;
    return { user, accessToken: data.accessToken };
  },
};
