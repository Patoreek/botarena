"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { apiFetch } from "@/lib/api";
import type { MarketDataResponse, RunInterval } from "@repo/shared";
import { INTERVAL_MS } from "@repo/shared";

const MIN_POLL_MS = 3_000;

export function useMarketData(
  botId: string,
  runId: string | null,
  interval: RunInterval | null,
  enabled = true
) {
  const { accessToken } = useAuth();
  const [data, setData] = useState<MarketDataResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pollMs = interval ? Math.max(INTERVAL_MS[interval], MIN_POLL_MS) : MIN_POLL_MS;

  const fetchData = useCallback(async () => {
    if (!accessToken || !runId || !enabled) return;
    try {
      const result = await apiFetch<MarketDataResponse>(
        `/bots/${botId}/runs/${runId}/market`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      setData(result);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch market data");
    } finally {
      setLoading(false);
    }
  }, [accessToken, botId, runId, enabled]);

  useEffect(() => {
    if (!enabled || !runId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    fetchData();

    timerRef.current = setInterval(fetchData, pollMs);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [fetchData, pollMs, enabled, runId]);

  return { data, loading, error, refetch: fetchData };
}
