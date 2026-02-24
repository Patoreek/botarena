import { getSession } from "@/lib/auth/session";
import type { Session } from "@/lib/auth/types";

export type { Session };

/**
 * Server-only: returns current session or null.
 * Use in layouts/pages to protect routes and get user.
 */
export async function authGuard(): Promise<Session | null> {
  return getSession();
}
