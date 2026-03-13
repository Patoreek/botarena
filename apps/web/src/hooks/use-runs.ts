"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { apiFetch } from "@/lib/api";
import type {
  RunResponse,
  RunListResponse,
  RunLogListResponse,
  AllRunsListResponse,
  AllRunsItem,
  PaginationMeta,
  RunLogEntry,
} from "@repo/shared";

const defaultPagination: PaginationMeta = { total: 0, page: 1, limit: 10, totalPages: 0 };

export function useRuns(botId: string, params?: { page?: number; limit?: number; status?: string; sort?: string }) {
  const { accessToken } = useAuth();
  const [runs, setRuns] = useState<RunResponse[]>([]);
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
      if (params?.sort) qs.set("sort", params.sort);
      const data = await apiFetch<RunListResponse>(
        `/bots/${botId}/runs?${qs.toString()}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      setRuns(data.items);
      setPagination(data.pagination);
    } catch {
      setRuns([]);
    } finally {
      setLoading(false);
    }
  }, [accessToken, botId, params?.page, params?.limit, params?.status, params?.sort]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { runs, pagination, loading, refetch: fetch };
}

export function useRun(botId: string, runId: string | null) {
  const { accessToken } = useAuth();
  const [run, setRun] = useState<RunResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!accessToken || !runId) { setLoading(false); return; }
    setLoading(true);
    try {
      const data = await apiFetch<RunResponse>(
        `/bots/${botId}/runs/${runId}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      setRun(data);
    } catch {
      setRun(null);
    } finally {
      setLoading(false);
    }
  }, [accessToken, botId, runId]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { run, loading, refetch: fetch };
}

export function useRunLogs(botId: string, runId: string | null, params?: { page?: number; limit?: number }) {
  const { accessToken } = useAuth();
  const [logs, setLogs] = useState<RunLogEntry[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>(defaultPagination);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!accessToken || !runId) { setLoading(false); return; }
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (params?.page) qs.set("page", String(params.page));
      if (params?.limit) qs.set("limit", String(params.limit));
      const data = await apiFetch<RunLogListResponse>(
        `/bots/${botId}/runs/${runId}/logs?${qs.toString()}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      setLogs(data.items);
      setPagination(data.pagination);
    } catch {
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [accessToken, botId, runId, params?.page, params?.limit]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { logs, pagination, loading, refetch: fetch };
}

export interface ChartDataPoint {
  time: string;
  price: number;
  pnl: number;
  action: string;
  portfolioValue?: number;
}

export interface ChartResponse {
  points: ChartDataPoint[];
  initialInvestment: number;
  currentValue: number;
}

export function useChartData(botId: string, runId: string | null, pollInterval?: number) {
  const { accessToken } = useAuth();
  const [points, setPoints] = useState<ChartDataPoint[]>([]);
  const [initialInvestment, setInitialInvestment] = useState(0);
  const [currentValue, setCurrentValue] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!accessToken || !runId) { setLoading(false); return; }
    try {
      const data = await apiFetch<ChartResponse>(
        `/bots/${botId}/runs/${runId}/chart`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      setPoints(data.points);
      setInitialInvestment(data.initialInvestment);
      setCurrentValue(data.currentValue);
    } catch {
      // keep previous data on error
    } finally {
      setLoading(false);
    }
  }, [accessToken, botId, runId]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  // Auto-poll for active runs
  useEffect(() => {
    if (!pollInterval) return;
    const id = setInterval(fetch, pollInterval);
    return () => clearInterval(id);
  }, [fetch, pollInterval]);

  return { points, initialInvestment, currentValue, loading, refetch: fetch };
}

export function useAllRuns(params?: {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
  strategy?: string;
  exchange?: string;
}) {
  const { accessToken } = useAuth();
  const [runs, setRuns] = useState<AllRunsItem[]>([]);
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
      if (params?.search) qs.set("search", params.search);
      if (params?.strategy) qs.set("strategy", params.strategy);
      if (params?.exchange) qs.set("exchange", params.exchange);
      const data = await apiFetch<AllRunsListResponse>(
        `/runs?${qs.toString()}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      setRuns(data.items);
      setPagination(data.pagination);
    } catch {
      setRuns([]);
    } finally {
      setLoading(false);
    }
  }, [accessToken, params?.page, params?.limit, params?.status, params?.search, params?.strategy, params?.exchange]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { runs, pagination, loading, refetch: fetch };
}
