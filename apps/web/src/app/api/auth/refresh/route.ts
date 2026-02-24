import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const REFRESH_COOKIE = "refreshToken";
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60; // 7 days

/**
 * Proxies refresh to the backend using the same-origin refreshToken cookie.
 * Client calls this instead of the backend so the cookie is sent (same-origin).
 */
export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const refreshCookie = cookieStore.get(REFRESH_COOKIE);
  if (!refreshCookie?.value) {
    return NextResponse.json({ error: "No refresh token" }, { status: 401 });
  }

  const res = await fetch(`${API_URL}/auth/refresh`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: `${REFRESH_COOKIE}=${refreshCookie.value}`,
    },
    cache: "no-store",
  });

  const data = (await res.json().catch(() => ({}))) as {
    accessToken?: string;
    refreshToken?: string;
    error?: string;
  };

  if (!res.ok) {
    return NextResponse.json(
      { error: data.error ?? "Refresh failed" },
      { status: res.status }
    );
  }

  const nextRes = NextResponse.json({
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
  });

  if (data.refreshToken) {
    nextRes.cookies.set(REFRESH_COOKIE, data.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: COOKIE_MAX_AGE,
    });
  }

  return nextRes;
}
