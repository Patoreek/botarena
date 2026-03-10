"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
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
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

import { useAuth } from "@/lib/auth-context";
import { apiFetch } from "@/lib/api";
import { useBot, useBotLogs } from "@/hooks/use-bots";
import { useRuns, useRunLogs } from "@/hooks/use-runs";
import { INTERVAL_LABELS } from "@repo/shared";
import type { RunResponse, RunInterval } from "@repo/shared";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

// ─── Run Detail View ─────────────────────────────────────────────────────────

function RunDetail({ botId, run, onBack, onStatusChange }: { botId: string; run: RunResponse; onBack: () => void; onStatusChange: () => void }) {
  const { accessToken } = useAuth();
  const [logsPage, setLogsPage] = useState(1);
  const { logs, pagination: logsPagination, loading: logsLoading } = useRunLogs(botId, run.id, { page: logsPage, limit: 10 });
  const [actionLoading, setActionLoading] = useState(false);

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
              Interval: {INTERVAL_LABELS[run.interval as RunInterval]} &middot; Started {run.startedAt ? new Date(run.startedAt).toLocaleString() : "—"}
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

function RunsTab({ botId, onStartRun }: { botId: string; onStartRun: () => void }) {
  const { accessToken } = useAuth();
  const [runsPage, setRunsPage] = useState(1);
  const { runs, pagination, loading, refetch } = useRuns(botId, { page: runsPage, limit: 10 });
  const [selectedRun, setSelectedRun] = useState<RunResponse | null>(null);

  if (selectedRun) {
    return (
      <RunDetail
        botId={botId}
        run={selectedRun}
        onBack={() => { setSelectedRun(null); refetch(); }}
        onStatusChange={() => {
          refetch();
          if (accessToken) {
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
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSelectedRun(run)}>
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

export default function BotDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { accessToken } = useAuth();
  const { bot, loading, refetch } = useBot(params.id);
  const [showDelete, setShowDelete] = useState(false);
  const [showStartRun, setShowStartRun] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "runs">("overview");

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
        {(["overview", "runs"] as const).map((tab) => (
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
      {activeTab === "runs" && <RunsTab botId={bot.id} onStartRun={() => setShowStartRun(true)} />}

      <DeleteBotDialog open={showDelete} onOpenChange={setShowDelete} botName={bot.name} onConfirm={handleDelete} />
      <StartRunDialog botId={bot.id} open={showStartRun} onOpenChange={setShowStartRun} onCreated={() => { refetch(); setActiveTab("runs"); }} />
    </div>
  );
}
