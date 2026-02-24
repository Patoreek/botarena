import { cookies } from "next/headers";
import type { User } from "@repo/shared";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export type Session = { user: User; accessToken: string } | null;

export async function authGuard(): Promise<Session> {
  const cookieStore = await cookies();
  const refreshCookie = cookieStore.get("refreshToken");
  if (!refreshCookie?.value) return null;

  try {
    const refreshRes = await fetch(`${API_URL}/auth/refresh`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `refreshToken=${refreshCookie.value}`,
      },
      cache: "no-store",
    });
    if (!refreshRes.ok) return null;
    const { accessToken } = (await refreshRes.json()) as { accessToken: string };
    const meRes = await fetch(`${API_URL}/me`, {
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
