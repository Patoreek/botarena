import { cookies } from "next/headers";
import type { User } from "@repo/shared";
import { AUTH, cookieOptions } from "./config";
import type { Session } from "./types";

/**
 * Server-only: get current session from refresh cookie.
 * Uses /auth/verify which validates the token WITHOUT rotating it,
 * so the browser's cookie stays valid for client-side refresh.
 */
export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  const token = store.get(AUTH.cookieName)?.value;
  if (!token) return null;

  try {
    const res = await fetch(`${AUTH.apiUrl}/auth/verify`, {
      method: "POST",
      headers: {
        Cookie: `${AUTH.cookieName}=${token}`,
      },
      cache: "no-store",
    });

    if (!res.ok) return null;

    const data = (await res.json()) as { user: User; accessToken: string };
    return { user: data.user, accessToken: data.accessToken };
  } catch {
    return null;
  }
}

export { cookieOptions };
