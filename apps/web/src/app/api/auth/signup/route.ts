import { NextRequest, NextResponse } from "next/server";
import { setAuthCookie, callBackend } from "@/lib/auth/server";
import { signOneTimeToken } from "@/lib/auth/one-time-token";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const email = typeof body?.email === "string" ? body.email : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const name = typeof body?.name === "string" ? body.name.trim() || undefined : undefined;

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password required" }, { status: 400 });
  }

  const res = await callBackend("/auth/signup", {
    body: JSON.stringify({ email, password, name }),
  });

  const data = (await res.json().catch(() => ({}))) as {
    user?: {
      id: string;
      email: string;
      name?: string | null;
      createdAt?: unknown;
      updatedAt?: unknown;
    };
    accessToken?: string;
    refreshToken?: string;
    error?: string;
  };

  if (!res.ok) {
    return NextResponse.json({ error: data.error ?? "Signup failed" }, { status: res.status });
  }

  const nextRes = NextResponse.json(
    {
      user: data.user,
      accessToken: data.accessToken,
      oneTimeToken: data.user ? await signOneTimeToken(data.user) : undefined,
    },
    { status: 201 }
  );
  if (data.refreshToken) setAuthCookie(nextRes, data.refreshToken);
  return nextRes;
}
