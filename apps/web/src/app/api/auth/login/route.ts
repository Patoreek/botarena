import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const REFRESH_COOKIE = "refreshToken";
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60; // 7 days

/** Proxies login to backend and sets same-origin refreshToken cookie on success */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const email = typeof body?.email === "string" ? body.email : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password required" }, { status: 400 });
  }

  const res = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
    cache: "no-store",
  });

  const data = (await res.json().catch(() => ({}))) as {
    user?: unknown;
    accessToken?: string;
    refreshToken?: string;
    error?: string;
  };

  if (!res.ok) {
    return NextResponse.json(
      { error: data.error ?? "Login failed" },
      { status: res.status }
    );
  }

  const nextRes = NextResponse.json({
    user: data.user,
    accessToken: data.accessToken,
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
