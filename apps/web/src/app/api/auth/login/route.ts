import { NextRequest, NextResponse } from "next/server";
import { setAuthCookie, callBackend } from "@/lib/auth/server";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const email = typeof body?.email === "string" ? body.email : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password required" }, { status: 400 });
  }

  const res = await callBackend("/auth/login", {
    body: JSON.stringify({ email, password }),
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

  const nextRes = NextResponse.json({ user: data.user, accessToken: data.accessToken });
  if (data.refreshToken) setAuthCookie(nextRes, data.refreshToken);
  return nextRes;
}
