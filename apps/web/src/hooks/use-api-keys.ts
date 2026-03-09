"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { apiFetch } from "@/lib/api";
import type { ApiKeyResponse } from "@repo/shared";

export function useApiKeys() {
  const { accessToken } = useAuth();
  const [keys, setKeys] = useState<ApiKeyResponse[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const data = await apiFetch<ApiKeyResponse[]>("/api-keys", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      setKeys(data);
    } catch {
      setKeys([]);
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { keys, loading, refetch: fetch };
}
