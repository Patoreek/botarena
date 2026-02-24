import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const REFRESH_COOKIE = "refreshToken";

/** Proxies logout to backend (revokes token) and clears same-origin cookie */
export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const refreshCookie = cookieStore.get(REFRESH_COOKIE);

  if (refreshCookie?.value) {
    await fetch(`${API_URL}/auth/logout`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `${REFRESH_COOKIE}=${refreshCookie.value}`,
      },
      cache: "no-store",
    });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.delete(REFRESH_COOKIE);
  return res;
}
