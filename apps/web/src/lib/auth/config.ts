/**
 * Auth configuration — single source of truth for cookie and API settings.
 * Used by API routes, session helpers, and client.
 */

export const AUTH = {
  cookieName: "refreshToken",
  cookieMaxAge: 7 * 24 * 60 * 60, // 7 days in seconds
  apiUrl: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000",
} as const;

export const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: AUTH.cookieMaxAge,
};
