"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Pencil,
  Trash2,
  Play,
  Square,
  Pause,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Target,
  Activity,
  RotateCcw,
  Eye,
  Zap,
  CheckCircle2,
  XCircle,
  MinusCircle,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

import { useAuth } from "@/lib/auth-context";
import { apiFetch } from "@/lib/api";
import { useBot, useBotLogs } from "@/hooks/use-bots";
import { useRuns, useRun, useRunLogs } from "@/hooks/use-runs";
import { useMarketData } from "@/hooks/use-market-data";
import { INTERVAL_LABELS, INTERVAL_MS, DURATION_LABELS } from "@repo/shared";
import type { RunResponse, RunInterval, Kline, TickMetadata, RunLogEntry } from "@repo/shared";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Pagination } from "@/components/ui/pagination";
import { BotStatusBadge } from "@/components/bots/bot-status-badge";
import { RunStatusBadge } from "@/components/bots/run-status-badge";
import { DeleteBotDialog } from "@/components/bots/delete-bot-dialog";
import { StartRunDialog } from "@/components/bots/start-run-dialog";

// ─── Overview Tab ────────────────────────────────────────────────────────────

function OverviewTab({ bot }: { bot: any }) {
  const [logsPage, setLogsPage] = useState(1);
  const {
    logs,
    pagination: logsPagination,
    loading: logsLoading,
  } = useBotLogs(bot.id, { page: logsPage, limit: 10 });

  const stats = bot.stats;

  return (
    <div className="space-y-6">
      {stats && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Net PnL</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${stats.netPnl > 0 ? "text-emerald-600 dark:text-emerald-400" : stats.netPnl < 0 ? "text-red-600 dark:text-red-400" : ""}`}>
                {stats.netPnl > 0 ? "+" : ""}{stats.netPnl.toFixed(2)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Trades</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalTrades}</div>
              <p className="text-xs text-muted-foreground">{stats.totalBuys} buys / {stats.totalSells} sells</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.successRate.toFixed(1)}%</div>
              <p className="text-xs text-muted-foreground">{stats.winCount}W / {stats.lossCount}L</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">ROI</CardTitle>
              <TrendingDown className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.roi.toFixed(2)}%</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Max Drawdown</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.maxDrawdown.toFixed(2)}%</div>
            </CardContent>
          </Card>
        </div>
      )}

      {bot.gridConfig && (
        <>
          <Card>
            <CardHeader><CardTitle>Grid Configuration</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3 lg:grid-cols-4">
                <div><p className="text-muted-foreground">Upper Price</p><p className="font-medium">{bot.gridConfig.upperPrice}</p></div>
                <div><p className="text-muted-foreground">Lower Price</p><p className="font-medium">{bot.gridConfig.lowerPrice}</p></div>
                <div><p className="text-muted-foreground">Grid Count</p><p className="font-medium">{bot.gridConfig.gridCount}</p></div>
                <div><p className="text-muted-foreground">Grid Type</p><p className="font-medium capitalize">{bot.gridConfig.gridType.toLowerCase()}</p></div>
                <div><p className="text-muted-foreground">Grid Mode</p><p className="font-medium capitalize">{bot.gridConfig.gridMode.toLowerCase()}</p></div>
                <div><p className="text-muted-foreground">Total Investment</p><p className="font-medium">{bot.gridConfig.totalInvestment}</p></div>
                <div><p className="text-muted-foreground">Amount Per Grid</p><p className="font-medium">{bot.gridConfig.amountPerGrid}</p></div>
                <div><p className="text-muted-foreground">Order Type</p><p className="font-medium capitalize">{bot.gridConfig.orderType.toLowerCase()}</p></div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Risk Management</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3 lg:grid-cols-4">
                {bot.gridConfig.takeProfitPrice && <div><p className="text-muted-foreground">Take Profit</p><p className="font-medium">{bot.gridConfig.takeProfitPrice}</p></div>}
                <div><p className="text-muted-foreground">On Take Profit</p><p className="font-medium">{bot.gridConfig.takeProfitAction === "CLOSE_ALL" ? "Close All" : "Stop Only"}</p></div>
                {bot.gridConfig.stopLossPrice && <div><p className="text-muted-foreground">Stop Loss</p><p className="font-medium">{bot.gridConfig.stopLossPrice}</p></div>}
                <div><p className="text-muted-foreground">On Stop Loss</p><p className="font-medium">{bot.gridConfig.stopLossAction === "CLOSE_ALL" ? "Close All" : "Stop Only"}</p></div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Advanced Settings</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3 lg:grid-cols-4">
                {bot.gridConfig.triggerPrice && <div><p className="text-muted-foreground">Trigger Price</p><p className="font-medium">{bot.gridConfig.triggerPrice}</p></div>}
                {bot.gridConfig.minProfitPerGrid && <div><p className="text-muted-foreground">Min Profit Per Grid</p><p className="font-medium">{bot.gridConfig.minProfitPerGrid}%</p></div>}
                {bot.gridConfig.maxOpenOrders && <div><p className="text-muted-foreground">Max Open Orders</p><p className="font-medium">{bot.gridConfig.maxOpenOrders}</p></div>}
                <div><p className="text-muted-foreground">Trailing Up</p><p className="font-medium">{bot.gridConfig.trailingUp ? "Enabled" : "Disabled"}</p></div>
                <div><p className="text-muted-foreground">Trailing Down</p><p className="font-medium">{bot.gridConfig.trailingDown ? "Enabled" : "Disabled"}</p></div>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      <Card>
        <CardHeader><CardTitle>Activity Log</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {logsLoading ? (
            <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : logs.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">No activity yet</p>
          ) : (
            <>
              <Table>
                <TableHeader><TableRow><TableHead>Action</TableHead><TableHead>Message</TableHead><TableHead className="text-right">Time</TableHead></TableRow></TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell><Badge variant="outline" className="text-xs">{log.action.replace(/_/g, " ")}</Badge></TableCell>
                      <TableCell className="max-w-xs truncate">{log.message}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{new Date(log.createdAt).toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Pagination page={logsPagination.page} totalPages={logsPagination.totalPages} onPageChange={setLogsPage} />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatNum(v: string | number, decimals = 2): string {
  const n = typeof v === "string" ? parseFloat(v) : v;
  if (isNaN(n)) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(2)}K`;
  return n.toFixed(decimals);
}

function KlineRow({ kline, prev }: { kline: Kline; prev?: Kline }) {
  const close = parseFloat(kline.close);
  const prevClose = prev ? parseFloat(prev.close) : close;
  const isUp = close - prevClose >= 0;
  return (
    <TableRow className="text-xs">
      <TableCell className="text-muted-foreground whitespace-nowrap">
        {new Date(kline.openTime).toLocaleTimeString()}
      </TableCell>
      <TableCell>{formatNum(kline.open)}</TableCell>
      <TableCell className="text-emerald-600">{formatNum(kline.high)}</TableCell>
      <TableCell className="text-red-600">{formatNum(kline.low)}</TableCell>
      <TableCell className={`font-medium ${isUp ? "text-emerald-600" : "text-red-600"}`}>
        {formatNum(kline.close)}
      </TableCell>
      <TableCell className="text-right">{formatNum(kline.volume)}</TableCell>
    </TableRow>
  );
}

const DECISION_CONFIG = {
  BUY: { icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-500/10", label: "BUY" },
  SELL: { icon: XCircle, color: "text-red-600", bg: "bg-red-500/10", label: "SELL" },
  HOLD: { icon: MinusCircle, color: "text-muted-foreground", bg: "bg-muted", label: "HOLD" },
} as const;

function parseTickMeta(raw: unknown): TickMetadata | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  if (!obj.decision || !obj.price) return null;
  return raw as TickMetadata;
}

function getLogDecision(log: RunLogEntry): string {
  if (log.action === "TRADE_BUY") return "BUY";
  if (log.action === "TRADE_SELL") return "SELL";
  const tick = parseTickMeta(log.metadata);
  return tick?.decision ?? "HOLD";
}

interface DecisionGroup {
  decision: string;
  reason: string;
  position?: string;
  gridLevel?: string;
  entries: { id: string; price?: number; time: string }[];
}

function groupDecisions(logs: RunLogEntry[]): DecisionGroup[] {
  const groups: DecisionGroup[] = [];
  for (const log of logs) {
    const decision = getLogDecision(log);
    const tick = parseTickMeta(log.metadata);
    const reason = tick?.reason ?? log.message;
    const entry = {
      id: log.id,
      price: tick?.price,
      time: log.createdAt,
    };

    const last = groups[groups.length - 1];
    if (last && last.decision === decision && last.reason === reason) {
      last.entries.push(entry);
    } else {
      groups.push({
        decision,
        reason,
        position: tick?.position,
        gridLevel: tick?.gridLevel,
        entries: [entry],
      });
    }
  }
  return groups;
}

// ─── Bot Decisions Feed ──────────────────────────────────────────────────────

function BotDecisionsFeed({ botId, runId, interval, isActive }: { botId: string; runId: string; interval: RunInterval; isActive: boolean }) {
  const [page, setPage] = useState(1);
  const { logs, pagination, loading, refetch } = useRunLogs(botId, runId, { page, limit: 30 });
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const pollMs = Math.max(INTERVAL_MS[interval], 3_000);

  useEffect(() => {
    if (!isActive) return;
    timerRef.current = setInterval(refetch, pollMs);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isActive, pollMs, refetch]);

  const relevantLogs = logs.filter(
    (l) => l.action === "TICK" || l.action === "TRADE_BUY" || l.action === "TRADE_SELL"
  );
  const displayLogs = relevantLogs.length > 0 ? relevantLogs : logs;
  const groups = groupDecisions(displayLogs);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-4 w-4" />
              Bot Decisions
              {isActive && <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-amber-500" />}
            </CardTitle>
            <CardDescription>
              Each interval the bot evaluates market conditions and decides whether to execute a trade.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading && groups.length === 0 ? (
          <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
        ) : groups.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Zap className="h-8 w-8 text-muted-foreground" />
            <p className="mt-2 text-sm font-medium">No decisions yet</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {isActive
                ? "Waiting for the bot engine to produce tick data at each interval..."
                : "Start the run to see the bot's decisions here."}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="max-h-[28rem] space-y-2 overflow-auto">
              {groups.map((group) => {
                const cfg = DECISION_CONFIG[group.decision as keyof typeof DECISION_CONFIG] ?? DECISION_CONFIG.HOLD;
                const Icon = cfg.icon;
                const latestEntry = group.entries[0];
                const hasMultiple = group.entries.length > 1;

                return (
                  <div key={latestEntry.id} className={cn("rounded-lg border p-3", cfg.bg)}>
                    <div className="flex items-start gap-3">
                      <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", cfg.color)} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={cn("text-xs", cfg.color)}>{cfg.label}</Badge>
                          {latestEntry.price != null && (
                            <span className="text-sm font-semibold">${formatNum(latestEntry.price)}</span>
                          )}
                          {hasMultiple && (
                            <span className="text-xs text-muted-foreground">
                              &times;{group.entries.length} intervals
                            </span>
                          )}
                          <span className="ml-auto text-xs text-muted-foreground whitespace-nowrap">
                            {new Date(latestEntry.time).toLocaleTimeString()}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">{group.reason}</p>
                        {group.position && (
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            Position: <span className="font-medium text-foreground">{group.position}</span>
                            {group.gridLevel && <> &middot; Grid: <span className="font-medium text-foreground">{group.gridLevel}</span></>}
                          </p>
                        )}
                        {hasMultiple && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {group.entries.map((e) => (
                              <span
                                key={e.id}
                                className="inline-flex items-center gap-1 rounded bg-background/60 px-1.5 py-0.5 text-[10px] text-muted-foreground border"
                              >
                                {new Date(e.time).toLocaleTimeString()}
                                {e.price != null && <span className="font-medium">${formatNum(e.price)}</span>}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            {pagination.totalPages > 1 && (
              <Pagination page={pagination.page} totalPages={pagination.totalPages} onPageChange={setPage} />
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Run Detail View ─────────────────────────────────────────────────────────

function RunDetail({ botId, run, onBack, onStatusChange }: { botId: string; run: RunResponse; onBack: () => void; onStatusChange: () => void }) {
  const { accessToken } = useAuth();
  const [logsPage, setLogsPage] = useState(1);
  const { logs, pagination: logsPagination, loading: logsLoading } = useRunLogs(botId, run.id, { page: logsPage, limit: 10 });
  const [actionLoading, setActionLoading] = useState(false);
  const isRunActive = run.status === "RUNNING" || run.status === "PAUSED";
  const runInterval = run.interval as RunInterval;
  const { data: marketData, loading: marketLoading, error: marketError } = useMarketData(
    botId, run.id, runInterval, isRunActive
  );

  const handleAction = async (status: string) => {
    if (!accessToken) return;
    setActionLoading(true);
    try {
      await apiFetch(`/bots/${botId}/runs/${run.id}/status`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ status }),
      });
      toast.success(status === "PAUSED" ? "Run paused" : status === "RUNNING" ? "Run resumed" : "Run stopped");
      onStatusChange();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed");
    } finally {
      setActionLoading(false);
    }
  };

  const formatPnl = (v: number) => {
    if (v > 0) return <span className="text-emerald-600 dark:text-emerald-400">+{v.toFixed(2)}</span>;
    if (v < 0) return <span className="text-red-600 dark:text-red-400">{v.toFixed(2)}</span>;
    return <span className="text-muted-foreground">{v.toFixed(2)}</span>;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="h-4 w-4" /></Button>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold">{run.exchange} &middot; {run.marketPair}</h3>
              <RunStatusBadge status={run.status} />
            </div>
            <p className="text-sm text-muted-foreground">
              Interval: {INTERVAL_LABELS[runInterval]} &middot; Duration: {DURATION_LABELS[run.durationHours] ?? `${run.durationHours}h`} &middot; Started {run.startedAt ? new Date(run.startedAt).toLocaleString() : "—"}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {run.status === "RUNNING" && (
            <>
              <Button variant="outline" size="sm" onClick={() => handleAction("PAUSED")} disabled={actionLoading}>
                <Pause className="mr-2 h-4 w-4" /> Pause
              </Button>
              <Button variant="destructive" size="sm" onClick={() => handleAction("STOPPED")} disabled={actionLoading}>
                <Square className="mr-2 h-4 w-4" /> Stop
              </Button>
            </>
          )}
          {run.status === "PAUSED" && (
            <>
              <Button size="sm" onClick={() => handleAction("RUNNING")} disabled={actionLoading}>
                <Play className="mr-2 h-4 w-4" /> Resume
              </Button>
              <Button variant="destructive" size="sm" onClick={() => handleAction("STOPPED")} disabled={actionLoading}>
                <Square className="mr-2 h-4 w-4" /> Stop
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Run stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Net PnL</CardTitle></CardHeader>
          <CardContent><div className="text-xl font-bold">{formatPnl(run.stats.netPnl)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Total Trades</CardTitle></CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{run.stats.totalTrades}</div>
            <p className="text-xs text-muted-foreground">{run.stats.totalBuys}B / {run.stats.totalSells}S</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Win / Loss</CardTitle></CardHeader>
          <CardContent><div className="text-xl font-bold">{run.stats.winCount}W / {run.stats.lossCount}L</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">ROI</CardTitle></CardHeader>
          <CardContent><div className="text-xl font-bold">{run.stats.roi.toFixed(2)}%</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Profit / Loss</CardTitle></CardHeader>
          <CardContent>
            <p className="text-xs text-emerald-600">+{run.stats.totalProfit.toFixed(2)}</p>
            <p className="text-xs text-red-600">-{run.stats.totalLoss.toFixed(2)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Bot Decisions */}
      <BotDecisionsFeed botId={botId} runId={run.id} interval={runInterval} isActive={isRunActive} />

      {/* Live Market Data */}
      {isRunActive && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                Live Market Data
                {marketData && <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-emerald-500" />}
              </CardTitle>
              {marketData && (
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-2xl font-bold">${formatNum(marketData.lastPrice, 2)}</span>
                  <span className={`font-medium ${parseFloat(marketData.priceChangePercent) >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                    {parseFloat(marketData.priceChangePercent) >= 0 ? "+" : ""}{parseFloat(marketData.priceChangePercent).toFixed(2)}%
                  </span>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {marketLoading ? (
              <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
            ) : marketError ? (
              <p className="py-4 text-center text-sm text-destructive">{marketError}</p>
            ) : marketData ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
                  <div>
                    <p className="text-muted-foreground">24h Open</p>
                    <p className="font-medium">${formatNum(marketData.openPrice)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">24h High</p>
                    <p className="font-medium text-emerald-600">${formatNum(marketData.highPrice)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">24h Low</p>
                    <p className="font-medium text-red-600">${formatNum(marketData.lowPrice)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">24h Volume</p>
                    <p className="font-medium">{formatNum(marketData.quoteVolume)} USDT</p>
                  </div>
                </div>
                <div className="max-h-80 overflow-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow className="text-xs">
                        <TableHead>Time</TableHead>
                        <TableHead>Open</TableHead>
                        <TableHead>High</TableHead>
                        <TableHead>Low</TableHead>
                        <TableHead>Close</TableHead>
                        <TableHead className="text-right">Volume</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[...marketData.klines].reverse().map((kline, i, arr) => (
                        <KlineRow key={kline.openTime} kline={kline} prev={arr[i + 1]} />
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <p className="text-xs text-muted-foreground text-right">
                  Updated {new Date(marketData.fetchedAt).toLocaleTimeString()} &middot; Refreshes every {INTERVAL_LABELS[runInterval]}
                </p>
              </div>
            ) : null}
          </CardContent>
        </Card>
      )}

      {/* Chart placeholder */}
      <Card>
        <CardHeader><CardTitle>Performance Chart</CardTitle></CardHeader>
        <CardContent>
          <div className="flex h-48 items-center justify-center rounded-lg border border-dashed text-muted-foreground">Charts coming soon</div>
        </CardContent>
      </Card>

      {/* Run logs */}
      <Card>
        <CardHeader><CardTitle>Run Logs</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {logsLoading ? (
            <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : logs.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">No logs yet</p>
          ) : (
            <>
              <Table>
                <TableHeader><TableRow><TableHead>Action</TableHead><TableHead>Message</TableHead><TableHead className="text-right">Time</TableHead></TableRow></TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell><Badge variant="outline" className="text-xs">{log.action.replace(/_/g, " ")}</Badge></TableCell>
                      <TableCell className="max-w-xs truncate">{log.message}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{new Date(log.createdAt).toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Pagination page={logsPagination.page} totalPages={logsPagination.totalPages} onPageChange={setLogsPage} />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Runs Tab ────────────────────────────────────────────────────────────────

function RunsTab({
  botId,
  onStartRun,
  selectedRunId,
  onSelectRun,
}: {
  botId: string;
  onStartRun: () => void;
  selectedRunId: string | null;
  onSelectRun: (runId: string | null) => void;
}) {
  const { accessToken } = useAuth();
  const [runsPage, setRunsPage] = useState(1);
  const { runs, pagination, loading, refetch } = useRuns(botId, { page: runsPage, limit: 10 });
  const { run: fetchedRun, loading: runLoading } = useRun(botId, selectedRunId);
  const [selectedRun, setSelectedRun] = useState<RunResponse | null>(null);

  useEffect(() => {
    if (fetchedRun) setSelectedRun(fetchedRun);
  }, [fetchedRun]);

  const selectRun = useCallback(
    (run: RunResponse | null) => {
      setSelectedRun(run);
      onSelectRun(run?.id ?? null);
    },
    [onSelectRun]
  );

  if (selectedRunId && runLoading && !selectedRun) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
      </div>
    );
  }

  if (selectedRun) {
    return (
      <RunDetail
        botId={botId}
        run={selectedRun}
        onBack={() => { selectRun(null); refetch(); }}
        onStatusChange={() => {
          refetch();
          if (accessToken && selectedRun) {
            apiFetch<RunResponse>(`/bots/${botId}/runs/${selectedRun.id}`, {
              headers: { Authorization: `Bearer ${accessToken}` },
            }).then(setSelectedRun).catch(() => {});
          }
        }}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{pagination.total} run{pagination.total !== 1 ? "s" : ""} total</p>
        <Button size="sm" onClick={onStartRun}><Play className="mr-2 h-4 w-4" /> New Run</Button>
      </div>

      {loading ? (
        <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
      ) : runs.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <RotateCcw className="h-10 w-10 text-muted-foreground" />
            <p className="mt-3 text-lg font-semibold">No runs yet</p>
            <p className="mt-1 text-sm text-muted-foreground">Start your first run to see results here.</p>
            <Button className="mt-4" onClick={onStartRun}><Play className="mr-2 h-4 w-4" /> Start Run</Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
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
                  <TableCell>{run.exchange}</TableCell>
                  <TableCell className="font-medium">{run.marketPair}</TableCell>
                  <TableCell>{INTERVAL_LABELS[run.interval as RunInterval]}</TableCell>
                  <TableCell>{DURATION_LABELS[run.durationHours] ?? `${run.durationHours}h`}</TableCell>
                  <TableCell><RunStatusBadge status={run.status} /></TableCell>
                  <TableCell className="text-right">
                    <span className={run.stats.netPnl > 0 ? "text-emerald-600" : run.stats.netPnl < 0 ? "text-red-600" : ""}>
                      {run.stats.netPnl > 0 ? "+" : ""}{run.stats.netPnl.toFixed(2)}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">{run.stats.totalTrades}</TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {run.startedAt ? new Date(run.startedAt).toLocaleDateString() : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => selectRun(run)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Pagination page={pagination.page} totalPages={pagination.totalPages} onPageChange={setRunsPage} />
        </>
      )}
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

const TABS = ["overview", "runs"] as const;
type Tab = (typeof TABS)[number];

export default function BotDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { accessToken } = useAuth();
  const { bot, loading, refetch } = useBot(params.id);
  const [showDelete, setShowDelete] = useState(false);
  const [showStartRun, setShowStartRun] = useState(false);

  const tabFromUrl = searchParams.get("tab") as Tab | null;
  const activeTab: Tab = tabFromUrl && TABS.includes(tabFromUrl) ? tabFromUrl : "overview";
  const runIdFromUrl = searchParams.get("run");

  const updateUrl = useCallback(
    (tab: Tab, runId?: string | null) => {
      const newParams = new URLSearchParams();
      if (tab !== "overview") newParams.set("tab", tab);
      if (runId) newParams.set("run", runId);
      const qs = newParams.toString();
      router.replace(`/bots/${params.id}${qs ? `?${qs}` : ""}`, { scroll: false });
    },
    [router, params.id]
  );

  const setActiveTab = useCallback(
    (tab: Tab) => updateUrl(tab, tab === "runs" ? runIdFromUrl : null),
    [updateUrl, runIdFromUrl]
  );

  const setSelectedRunId = useCallback(
    (runId: string | null) => updateUrl("runs", runId),
    [updateUrl]
  );

  const handleDelete = async () => {
    if (!accessToken) return;
    try {
      await apiFetch(`/bots/${params.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      toast.success("Bot deleted");
      router.push("/bots");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
      </div>
    );
  }

  if (!bot) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <h2 className="text-xl font-semibold">Bot not found</h2>
        <Button asChild className="mt-4"><Link href="/bots">Back to Bots</Link></Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild><Link href="/bots"><ArrowLeft className="h-4 w-4" /></Link></Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">{bot.name}</h1>
              <BotStatusBadge status={bot.status} />
            </div>
            <p className="text-sm text-muted-foreground"><Badge variant="outline">{bot.strategy}</Badge></p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={() => setShowStartRun(true)}>
            <Play className="mr-2 h-4 w-4" /> Start Run
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/bots/${bot.id}/edit`}><Pencil className="mr-2 h-4 w-4" /> Edit</Link>
          </Button>
          <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={() => setShowDelete(true)}>
            <Trash2 className="mr-2 h-4 w-4" /> Delete
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "border-b-2 px-4 py-2 text-sm font-medium capitalize transition-colors",
              activeTab === tab
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "overview" && <OverviewTab bot={bot} />}
      {activeTab === "runs" && (
        <RunsTab
          botId={bot.id}
          onStartRun={() => setShowStartRun(true)}
          selectedRunId={runIdFromUrl}
          onSelectRun={setSelectedRunId}
        />
      )}

      <DeleteBotDialog open={showDelete} onOpenChange={setShowDelete} botName={bot.name} onConfirm={handleDelete} />
      <StartRunDialog
        botId={bot.id}
        open={showStartRun}
        onOpenChange={setShowStartRun}
        onCreated={() => { refetch(); setActiveTab("runs"); }}
      />
    </div>
  );
}
