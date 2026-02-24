/**
 * Auth module — use these entry points:
 *
 * - Server (RSC, route handlers): getSession, authGuard, server helpers
 * - Client: authApi, useAuth (from auth-context)
 */

export { getSession, cookieOptions } from "./session";
export { authApi } from "./client";
export { AuthError } from "./types";
export type { Session, AuthResult } from "./types";
export { AUTH } from "./config";
