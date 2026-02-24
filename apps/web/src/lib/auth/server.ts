import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { AUTH, cookieOptions } from "./config";

/**
 * Server-only helpers for auth API routes.
 */

export function setAuthCookie(response: NextResponse, refreshToken: string): void {
  response.cookies.set(AUTH.cookieName, refreshToken, cookieOptions);
}

export function clearAuthCookie(response: NextResponse): void {
  response.cookies.delete(AUTH.cookieName);
}

export async function getRefreshTokenFromRequest(): Promise<string | null> {
  const store = await cookies();
  return store.get(AUTH.cookieName)?.value ?? null;
}

export async function callBackend(
  path: string,
  options: {
    method?: string;
    body?: string;
    cookie?: string | null;
  } = {}
): Promise<Response> {
  const { method = "POST", body, cookie } = options;
  const headers: Record<string, string> = {};
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  if (cookie) {
    headers.Cookie = `${AUTH.cookieName}=${cookie}`;
  }
  try {
    return await fetch(`${AUTH.apiUrl}${path}`, {
      method,
      headers,
      body: body ?? undefined,
      cache: "no-store",
    });
  } catch (err) {
    const isRefused =
      err instanceof TypeError &&
      (err as { cause?: { code?: string } }).cause?.code === "ECONNREFUSED";
    const message = isRefused
      ? "Auth service unavailable. Is the API server running? (e.g. pnpm dev at repo root)"
      : "Auth service request failed";
    return new Response(JSON.stringify({ error: message }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }
}
