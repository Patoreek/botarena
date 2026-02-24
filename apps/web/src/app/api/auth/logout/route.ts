import { NextResponse } from "next/server";
import { getRefreshTokenFromRequest, callBackend, clearAuthCookie } from "@/lib/auth/server";

export async function POST() {
  const token = await getRefreshTokenFromRequest();
  if (token) {
    await callBackend("/auth/logout", { cookie: token });
  }

  const res = NextResponse.json({ ok: true });
  clearAuthCookie(res);
  return res;
}
