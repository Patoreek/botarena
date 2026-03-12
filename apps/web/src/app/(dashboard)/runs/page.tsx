"use client";

import { useState } from "react";
import Link from "next/link";
import { Eye, RotateCcw, Clock } from "lucide-react";

import { useAllRuns } from "@/hooks/use-runs";
import {
  INTERVAL_LABELS,
  DURATION_LABELS,
  type RunInterval,
  type RunStatus,
} from "@repo/shared";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Pagination } from "@/components/ui/pagination";
import { RunStatusBadge } from "@/components/bots/run-status-badge";

export default function RunsPage() {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [strategyFilter, setStrategyFilter] = useState("");
  const [exchangeFilter, setExchangeFilter] = useState("");

  const { runs, pagination, loading } = useAllRuns({
    page,
    limit,
    search: search || undefined,
    status: statusFilter || undefined,
    strategy: strategyFilter || undefined,
    exchange: exchangeFilter || undefined,
  });

  const formatPnl = (value: number) => {
    const formatted = value.toFixed(2);
    if (value > 0) return <span className="text-emerald-600 dark:text-emerald-400">+{formatted}</span>;
    if (value < 0) return <span className="text-red-600 dark:text-red-400">{formatted}</span>;
    return <span className="text-muted-foreground">{formatted}</span>;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Runs</h1>
        <p className="text-muted-foreground">All bot runs across your trading bots</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <Input
          placeholder="Search by bot name..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="sm:max-w-xs"
        />
        <Select
          value={statusFilter}
          onValueChange={(v) => { setStatusFilter(v === "ALL" ? "" : v); setPage(1); }}
        >
          <SelectTrigger className="w-full sm:w-[160px]">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All statuses</SelectItem>
            <SelectItem value="PENDING">Pending</SelectItem>
            <SelectItem value="RUNNING">Running</SelectItem>
            <SelectItem value="PAUSED">Paused</SelectItem>
            <SelectItem value="STOPPED">Stopped</SelectItem>
            <SelectItem value="COMPLETED">Completed</SelectItem>
            <SelectItem value="ERROR">Error</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={strategyFilter}
          onValueChange={(v) => { setStrategyFilter(v === "ALL" ? "" : v); setPage(1); }}
        >
          <SelectTrigger className="w-full sm:w-[160px]">
            <SelectValue placeholder="All strategies" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All strategies</SelectItem>
            <SelectItem value="GRID">Grid</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={exchangeFilter}
          onValueChange={(v) => { setExchangeFilter(v === "ALL" ? "" : v); setPage(1); }}
        >
          <SelectTrigger className="w-full sm:w-[160px]">
            <SelectValue placeholder="All exchanges" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All exchanges</SelectItem>
            <SelectItem value="BINANCE">Binance</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={String(limit)}
          onValueChange={(v) => { setLimit(Number(v)); setPage(1); }}
        >
          <SelectTrigger className="w-full sm:w-[130px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="5">5 per page</SelectItem>
            <SelectItem value="10">10 per page</SelectItem>
            <SelectItem value="25">25 per page</SelectItem>
            <SelectItem value="50">50 per page</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : runs.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16">
          <RotateCcw className="h-12 w-12 text-muted-foreground" />
          <h3 className="mt-4 text-lg font-semibold">No runs found</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {search || statusFilter || strategyFilter || exchangeFilter
              ? "Try adjusting your filters."
              : "Start a run from one of your bots to see it here."}
          </p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Bot</TableHead>
                  <TableHead>Strategy</TableHead>
                  <TableHead>Exchange</TableHead>
                  <TableHead>Pair</TableHead>
                  <TableHead>Interval</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">PnL</TableHead>
                  <TableHead className="text-right">Trades</TableHead>
                  <TableHead className="text-right">Started</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.map((run) => (
                  <TableRow key={run.id}>
                    <TableCell className="font-medium">
                      <Link href={`/bots/${run.botId}`} className="hover:underline">
                        {run.botName}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{run.botStrategy}</Badge>
                    </TableCell>
                    <TableCell>{run.exchange}</TableCell>
                    <TableCell className="font-medium">{run.marketPair}</TableCell>
                    <TableCell>{INTERVAL_LABELS[run.interval as RunInterval]}</TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1 text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {DURATION_LABELS[run.durationHours] ?? `${run.durationHours}h`}
                      </span>
                    </TableCell>
                    <TableCell><RunStatusBadge status={run.status as RunStatus} /></TableCell>
                    <TableCell className="text-right">{formatPnl(run.stats.netPnl)}</TableCell>
                    <TableCell className="text-right">{run.stats.totalTrades}</TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {run.startedAt ? new Date(run.startedAt).toLocaleDateString() : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                        <Link href={`/bots/${run.botId}?tab=runs&run=${run.id}`}>
                          <Eye className="h-4 w-4" />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Mobile cards */}
          <div className="space-y-3 md:hidden">
            {runs.map((run) => (
              <div key={run.id} className="rounded-lg border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <Link href={`/bots/${run.botId}`} className="font-medium hover:underline">
                    {run.botName}
                  </Link>
                  <RunStatusBadge status={run.status as RunStatus} />
                </div>
                <div className="flex flex-wrap gap-2 text-sm">
                  <Badge variant="outline">{run.botStrategy}</Badge>
                  <span className="text-muted-foreground">{run.exchange}</span>
                  <span className="font-medium">{run.marketPair}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {INTERVAL_LABELS[run.interval as RunInterval]} &middot; {DURATION_LABELS[run.durationHours] ?? `${run.durationHours}h`}
                  </span>
                  <span>PnL: {formatPnl(run.stats.netPnl)}</span>
                </div>
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>{run.stats.totalTrades} trade{run.stats.totalTrades !== 1 ? "s" : ""}</span>
                  <span>{run.startedAt ? new Date(run.startedAt).toLocaleDateString() : "—"}</span>
                </div>
                <Button variant="outline" size="sm" asChild className="w-full">
                  <Link href={`/bots/${run.botId}?tab=runs&run=${run.id}`}>View Run</Link>
                </Button>
              </div>
            ))}
          </div>

          <Pagination
            page={pagination.page}
            totalPages={pagination.totalPages}
            onPageChange={setPage}
          />
        </>
      )}
    </div>
  );
}
