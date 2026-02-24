import { cookies } from "next/headers";
import type { User } from "@repo/shared";
import { AUTH, cookieOptions } from "./config";
import type { Session } from "./types";

/**
 * Server-only: get current session from refresh cookie.
 * Calls backend /auth/refresh with the cookie and returns user + accessToken, or null.
 */
export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  const token = store.get(AUTH.cookieName)?.value;
  if (!token) return null;

  try {
    const refreshRes = await fetch(`${AUTH.apiUrl}/auth/refresh`, {
      method: "POST",
      headers: {
        Cookie: `${AUTH.cookieName}=${token}`,
      },
      cache: "no-store",
    });

    if (!refreshRes.ok) return null;

    const { accessToken } = (await refreshRes.json()) as { accessToken: string };
    const meRes = await fetch(`${AUTH.apiUrl}/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });

    if (!meRes.ok) return null;

    const user = (await meRes.json()) as User;
    return { user, accessToken };
  } catch {
    return null;
  }
}

export { cookieOptions };
