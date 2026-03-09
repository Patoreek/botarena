"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { apiFetch } from "@/lib/api";
import type {
  BotListResponse,
  BotResponse,
  BotLogListResponse,
  BotListItem,
  PaginationMeta,
  BotLogEntry,
} from "@repo/shared";

interface UseBotListParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  sortBy?: string;
  sortOrder?: string;
}

export function useBots(params: UseBotListParams = {}) {
  const { accessToken } = useAuth();
  const [bots, setBots] = useState<BotListItem[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>({
    total: 0,
    page: 1,
    limit: 10,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const serialized = JSON.stringify(params);

  const fetchBots = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams();
      const p: UseBotListParams = JSON.parse(serialized);
      if (p.page) query.set("page", String(p.page));
      if (p.limit) query.set("limit", String(p.limit));
      if (p.search) query.set("search", p.search);
      if (p.status) query.set("status", p.status);
      if (p.sortBy) query.set("sortBy", p.sortBy);
      if (p.sortOrder) query.set("sortOrder", p.sortOrder);

      const data = await apiFetch<BotListResponse>(`/bots?${query.toString()}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      setBots(data.items);
      setPagination(data.pagination);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch bots");
    } finally {
      setLoading(false);
    }
  }, [accessToken, serialized]);

  useEffect(() => {
    fetchBots();
  }, [fetchBots]);

  return { bots, pagination, loading, error, refetch: fetchBots };
}

export function useBot(id: string) {
  const { accessToken } = useAuth();
  const [bot, setBot] = useState<BotResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBot = useCallback(async () => {
    if (!accessToken || !id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<BotResponse>(`/bots/${id}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      setBot(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch bot");
    } finally {
      setLoading(false);
    }
  }, [accessToken, id]);

  useEffect(() => {
    fetchBot();
  }, [fetchBot]);

  return { bot, loading, error, refetch: fetchBot };
}

export function useBotLogs(id: string, params: { page?: number; limit?: number } = {}) {
  const { accessToken } = useAuth();
  const [logs, setLogs] = useState<BotLogEntry[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>({
    total: 0,
    page: 1,
    limit: 20,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const serialized = JSON.stringify(params);

  const fetchLogs = useCallback(async () => {
    if (!accessToken || !id) return;
    setLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams();
      const p = JSON.parse(serialized);
      if (p.page) query.set("page", String(p.page));
      if (p.limit) query.set("limit", String(p.limit));

      const data = await apiFetch<BotLogListResponse>(`/bots/${id}/logs?${query.toString()}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      setLogs(data.items);
      setPagination(data.pagination);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch logs");
    } finally {
      setLoading(false);
    }
  }, [accessToken, id, serialized]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  return { logs, pagination, loading, error, refetch: fetchLogs };
}
