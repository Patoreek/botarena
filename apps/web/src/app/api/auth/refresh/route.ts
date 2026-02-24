import { NextResponse } from "next/server";
import { getRefreshTokenFromRequest, callBackend, setAuthCookie } from "@/lib/auth/server";

export async function POST() {
  const token = await getRefreshTokenFromRequest();
  if (!token) {
    return NextResponse.json({ error: "No refresh token" }, { status: 401 });
  }

  const res = await callBackend("/auth/refresh", { cookie: token });
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
  if (data.refreshToken) setAuthCookie(nextRes, data.refreshToken);
  return nextRes;
}
