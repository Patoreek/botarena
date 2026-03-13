"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { Square } from "lucide-react";

import { useAuth } from "@/lib/auth-context";
import { apiFetch } from "@/lib/api";
import { useArena, useArenaChart, useArenaEntryLogs } from "@/hooks/use-arenas";
import { INTERVAL_LABELS, type RunInterval, type ArenaStatus, type ArenaEntry } from "@repo/shared";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
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
import { Pagination } from "@/components/ui/pagination";
import { ArenaStatusBadge } from "@/components/arena/arena-status-badge";
import { ArenaChart } from "@/components/arena/arena-chart";
import { ArenaLeaderboard } from "@/components/arena/arena-leaderboard";

export default function ArenaDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { accessToken } = useAuth();
  const arenaId = params.id as string;

  const isRunning = (status?: string) => status === "RUNNING";

  const { arena, loading, refetch } = useArena(arenaId, 5000);
  const { series, loading: chartLoading } = useArenaChart(
    arenaId,
    arena && isRunning(arena.status) ? 5000 : undefined
  );

  const [stopping, setStopping] = useState(false);
  const [activeTab, setActiveTab] = useState<"leaderboard" | "logs">("leaderboard");
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [logPage, setLogPage] = useState(1);

  const { logs, pagination: logPagination, loading: logsLoading } = useArenaEntryLogs(
    arenaId,
    selectedEntryId,
    { page: logPage, limit: 20 }
  );

  const handleStop = async () => {
    if (!accessToken || !arena) return;
    setStopping(true);
    try {
      await apiFetch(`/arenas/${arenaId}/status`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ status: "STOPPED" }),
      });
      toast.success("Arena stopped");
      refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to stop arena");
    } finally {
      setStopping(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-80 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!arena) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <h2 className="text-lg font-semibold">Arena not found</h2>
        <Button variant="outline" className="mt-4" onClick={() => router.push("/arena")}>
          Back to Arenas
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{arena.name}</h1>
            <ArenaStatusBadge status={arena.status as ArenaStatus} />
          </div>
          <p className="text-muted-foreground">
            {arena.exchange} / {arena.marketPair}
            {" · "}
            {INTERVAL_LABELS[arena.interval as RunInterval] ?? arena.interval}
            {" · "}
            {arena.durationHours}h
            {" · "}
            {arena.entries.length} bots
          </p>
        </div>
        {isRunning(arena.status) && (
          <Button variant="destructive" onClick={handleStop} disabled={stopping}>
            <Square className="mr-2 h-4 w-4" />
            {stopping ? "Stopping..." : "Stop Arena"}
          </Button>
        )}
      </div>

      {/* Chart */}
      <div className="rounded-lg border p-4">
        <h2 className="mb-3 text-lg font-semibold">Performance</h2>
        <ArenaChart series={series} loading={chartLoading} />
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b">
        <button
          onClick={() => setActiveTab("leaderboard")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "leaderboard"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Leaderboard
        </button>
        <button
          onClick={() => setActiveTab("logs")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "logs"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Logs
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === "leaderboard" && (
        <div className="space-y-4">
          <ArenaLeaderboard entries={arena.entries} />

          {/* Bot Summary Cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {arena.entries.map((entry) => (
              <BotSummaryCard key={entry.id} entry={entry} />
            ))}
          </div>
        </div>
      )}

      {activeTab === "logs" && (
        <div className="space-y-4">
          <Select
            value={selectedEntryId ?? ""}
            onValueChange={(v) => {
              setSelectedEntryId(v || null);
              setLogPage(1);
            }}
          >
            <SelectTrigger className="w-full sm:w-[250px]">
              <SelectValue placeholder="Select a bot to view logs" />
            </SelectTrigger>
            <SelectContent>
              {arena.entries.map((entry) => (
                <SelectItem key={entry.id} value={entry.id}>
                  {entry.botName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {selectedEntryId ? (
            logsLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : logs.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                No logs yet for this bot.
              </p>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[140px]">Time</TableHead>
                      <TableHead className="w-[100px]">Action</TableHead>
                      <TableHead>Message</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(log.createdAt).toLocaleTimeString()}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {log.action}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">{log.message}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <Pagination
                  page={logPagination.page}
                  totalPages={logPagination.totalPages}
                  onPageChange={setLogPage}
                />
              </>
            )
          ) : (
            <p className="text-sm text-muted-foreground py-8 text-center">
              Select a bot above to view its logs.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function BotSummaryCard({ entry }: { entry: ArenaEntry }) {
  const formatPnl = (value: number) => {
    const formatted = value.toFixed(4);
    if (value > 0) return <span className="text-emerald-600 dark:text-emerald-400">+{formatted}</span>;
    if (value < 0) return <span className="text-red-600 dark:text-red-400">{formatted}</span>;
    return <span className="text-muted-foreground">{formatted}</span>;
  };

  const winRate = entry.stats.totalTrades > 0
    ? ((entry.stats.winCount / entry.stats.totalTrades) * 100).toFixed(1)
    : "0.0";

  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <span className="font-medium">{entry.botName}</span>
          {entry.rank && (
            <span className="ml-2 text-xs text-muted-foreground">#{entry.rank}</span>
          )}
        </div>
        <Badge variant="outline" className="text-xs">{entry.botStrategy}</Badge>
      </div>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div>
          <span className="text-muted-foreground">Net PnL</span>
          <div>{formatPnl(entry.stats.netPnl)}</div>
        </div>
        <div>
          <span className="text-muted-foreground">ROI</span>
          <div>{entry.stats.roi.toFixed(2)}%</div>
        </div>
        <div>
          <span className="text-muted-foreground">Trades</span>
          <div>{entry.stats.totalTrades}</div>
        </div>
        <div>
          <span className="text-muted-foreground">Win Rate</span>
          <div>{winRate}%</div>
        </div>
      </div>
    </div>
  );
}
