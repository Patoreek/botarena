"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { apiFetch } from "@/lib/api";
import type {
  ArenaResponse,
  ArenaListResponse,
  ArenaListItem,
  PaginationMeta,
  RunLogListResponse,
  RunLogEntry,
} from "@repo/shared";

const defaultPagination: PaginationMeta = { total: 0, page: 1, limit: 10, totalPages: 0 };

export function useArenas(params?: { page?: number; limit?: number; status?: string }) {
  const { accessToken } = useAuth();
  const [arenas, setArenas] = useState<ArenaListItem[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>(defaultPagination);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (params?.page) qs.set("page", String(params.page));
      if (params?.limit) qs.set("limit", String(params.limit));
      if (params?.status) qs.set("status", params.status);
      const data = await apiFetch<ArenaListResponse>(
        `/arenas?${qs.toString()}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      setArenas(data.items);
      setPagination(data.pagination);
    } catch {
      setArenas([]);
    } finally {
      setLoading(false);
    }
  }, [accessToken, params?.page, params?.limit, params?.status]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { arenas, pagination, loading, refetch: fetch };
}

export function useArena(arenaId: string | null, pollInterval?: number) {
  const { accessToken } = useAuth();
  const [arena, setArena] = useState<ArenaResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!accessToken || !arenaId) { setLoading(false); return; }
    try {
      const data = await apiFetch<ArenaResponse>(
        `/arenas/${arenaId}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      setArena(data);
    } catch {
      setArena(null);
    } finally {
      setLoading(false);
    }
  }, [accessToken, arenaId]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  useEffect(() => {
    if (!pollInterval) return;
    const id = setInterval(fetch, pollInterval);
    return () => clearInterval(id);
  }, [fetch, pollInterval]);

  return { arena, loading, refetch: fetch };
}

export function useArenaEntryLogs(
  arenaId: string | null,
  entryId: string | null,
  params?: { page?: number; limit?: number }
) {
  const { accessToken } = useAuth();
  const [logs, setLogs] = useState<RunLogEntry[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>(defaultPagination);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!accessToken || !arenaId || !entryId) { setLoading(false); return; }
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (params?.page) qs.set("page", String(params.page));
      if (params?.limit) qs.set("limit", String(params.limit));
      const data = await apiFetch<RunLogListResponse>(
        `/arenas/${arenaId}/entries/${entryId}/logs?${qs.toString()}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      setLogs(data.items);
      setPagination(data.pagination);
    } catch {
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [accessToken, arenaId, entryId, params?.page, params?.limit]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { logs, pagination, loading, refetch: fetch };
}

export interface ArenaChartSeries {
  entryId: string;
  botName: string;
  botId: string;
  points: Array<{ time: string; pnl: number; price: number }>;
}

export function useArenaChart(arenaId: string | null, pollInterval?: number) {
  const { accessToken } = useAuth();
  const [series, setSeries] = useState<ArenaChartSeries[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!accessToken || !arenaId) { setLoading(false); return; }
    try {
      const data = await apiFetch<{ series: ArenaChartSeries[] }>(
        `/arenas/${arenaId}/chart`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      setSeries(data.series);
    } catch {
      // keep previous data
    } finally {
      setLoading(false);
    }
  }, [accessToken, arenaId]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  useEffect(() => {
    if (!pollInterval) return;
    const id = setInterval(fetch, pollInterval);
    return () => clearInterval(id);
  }, [fetch, pollInterval]);

  return { series, loading, refetch: fetch };
}
