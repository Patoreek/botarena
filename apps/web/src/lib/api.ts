const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export type ApiError = { error: string; details?: unknown };

export async function apiFetch<T>(
  path: string,
  options: RequestInit & { credentials?: RequestCredentials } = {}
): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: options.credentials ?? "include",
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as ApiError).error ?? res.statusText);
  }
  return data as T;
}

export function getWsUrl(token: string): string {
  const base = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:4000/ws";
  const url = new URL(base);
  url.searchParams.set("token", token);
  return url.toString();
}
