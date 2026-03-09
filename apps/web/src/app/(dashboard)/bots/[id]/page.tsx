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
  TrendingUp,
  TrendingDown,
  BarChart3,
  Target,
  Activity,
} from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/lib/auth-context";
import { apiFetch } from "@/lib/api";
import { useBot, useBotLogs } from "@/hooks/use-bots";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
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
import { DeleteBotDialog } from "@/components/bots/delete-bot-dialog";

export default function BotDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { accessToken } = useAuth();
  const { bot, loading, refetch } = useBot(params.id);
  const [logsPage, setLogsPage] = useState(1);
  const {
    logs,
    pagination: logsPagination,
    loading: logsLoading,
  } = useBotLogs(params.id, { page: logsPage, limit: 10 });
  const [showDelete, setShowDelete] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);

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

  const handleToggleStatus = async () => {
    if (!bot || !accessToken) return;
    const newStatus = bot.status === "RUNNING" ? "STOPPED" : "RUNNING";
    setStatusLoading(true);
    try {
      await apiFetch(`/bots/${params.id}/status`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ status: newStatus }),
      });
      toast.success(newStatus === "RUNNING" ? "Bot started" : "Bot stopped");
      refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update status");
    } finally {
      setStatusLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      </div>
    );
  }

  if (!bot) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <h2 className="text-xl font-semibold">Bot not found</h2>
        <Button asChild className="mt-4">
          <Link href="/bots">Back to Bots</Link>
        </Button>
      </div>
    );
  }

  const stats = bot.stats;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/bots">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">{bot.name}</h1>
              <BotStatusBadge status={bot.status} />
            </div>
            <p className="text-sm text-muted-foreground">
              <Badge variant="outline">{bot.strategy}</Badge>
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant={bot.status === "RUNNING" ? "destructive" : "default"}
            size="sm"
            onClick={handleToggleStatus}
            disabled={statusLoading}
          >
            {bot.status === "RUNNING" ? (
              <>
                <Square className="mr-2 h-4 w-4" /> Stop
              </>
            ) : (
              <>
                <Play className="mr-2 h-4 w-4" /> Start
              </>
            )}
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/bots/${bot.id}/edit`}>
              <Pencil className="mr-2 h-4 w-4" /> Edit
            </Link>
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={() => setShowDelete(true)}
          >
            <Trash2 className="mr-2 h-4 w-4" /> Delete
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Net PnL</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div
                className={`text-2xl font-bold ${
                  stats.netPnl > 0
                    ? "text-emerald-600 dark:text-emerald-400"
                    : stats.netPnl < 0
                      ? "text-red-600 dark:text-red-400"
                      : ""
                }`}
              >
                {stats.netPnl > 0 ? "+" : ""}
                {stats.netPnl.toFixed(2)}
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
              <p className="text-xs text-muted-foreground">
                {stats.totalBuys} buys / {stats.totalSells} sells
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.successRate.toFixed(1)}%</div>
              <p className="text-xs text-muted-foreground">
                {stats.winCount}W / {stats.lossCount}L
              </p>
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

      {/* Grid Config */}
      {bot.gridConfig && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Grid Configuration</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3 lg:grid-cols-4">
                <div>
                  <p className="text-muted-foreground">Upper Price</p>
                  <p className="font-medium">{bot.gridConfig.upperPrice}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Lower Price</p>
                  <p className="font-medium">{bot.gridConfig.lowerPrice}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Grid Count</p>
                  <p className="font-medium">{bot.gridConfig.gridCount}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Grid Type</p>
                  <p className="font-medium capitalize">{bot.gridConfig.gridType.toLowerCase()}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Grid Mode</p>
                  <p className="font-medium capitalize">{bot.gridConfig.gridMode.toLowerCase()}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Total Investment</p>
                  <p className="font-medium">{bot.gridConfig.totalInvestment}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Amount Per Grid</p>
                  <p className="font-medium">{bot.gridConfig.amountPerGrid}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Order Type</p>
                  <p className="font-medium capitalize">{bot.gridConfig.orderType.toLowerCase()}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Risk Management</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3 lg:grid-cols-4">
                {bot.gridConfig.takeProfitPrice && (
                  <div>
                    <p className="text-muted-foreground">Take Profit</p>
                    <p className="font-medium">{bot.gridConfig.takeProfitPrice}</p>
                  </div>
                )}
                <div>
                  <p className="text-muted-foreground">On Take Profit</p>
                  <p className="font-medium">{bot.gridConfig.takeProfitAction === "CLOSE_ALL" ? "Close All" : "Stop Only"}</p>
                </div>
                {bot.gridConfig.stopLossPrice && (
                  <div>
                    <p className="text-muted-foreground">Stop Loss</p>
                    <p className="font-medium">{bot.gridConfig.stopLossPrice}</p>
                  </div>
                )}
                <div>
                  <p className="text-muted-foreground">On Stop Loss</p>
                  <p className="font-medium">{bot.gridConfig.stopLossAction === "CLOSE_ALL" ? "Close All" : "Stop Only"}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Advanced Settings</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3 lg:grid-cols-4">
                {bot.gridConfig.triggerPrice && (
                  <div>
                    <p className="text-muted-foreground">Trigger Price</p>
                    <p className="font-medium">{bot.gridConfig.triggerPrice}</p>
                  </div>
                )}
                {bot.gridConfig.minProfitPerGrid && (
                  <div>
                    <p className="text-muted-foreground">Min Profit Per Grid</p>
                    <p className="font-medium">{bot.gridConfig.minProfitPerGrid}%</p>
                  </div>
                )}
                {bot.gridConfig.maxOpenOrders && (
                  <div>
                    <p className="text-muted-foreground">Max Open Orders</p>
                    <p className="font-medium">{bot.gridConfig.maxOpenOrders}</p>
                  </div>
                )}
                <div>
                  <p className="text-muted-foreground">Trailing Up</p>
                  <p className="font-medium">{bot.gridConfig.trailingUp ? "Enabled" : "Disabled"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Trailing Down</p>
                  <p className="font-medium">{bot.gridConfig.trailingDown ? "Enabled" : "Disabled"}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Charts placeholder */}
      <Card>
        <CardHeader>
          <CardTitle>Performance Charts</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-48 items-center justify-center rounded-lg border border-dashed text-muted-foreground">
            Charts coming soon
          </div>
        </CardContent>
      </Card>

      {/* Activity Log */}
      <Card>
        <CardHeader>
          <CardTitle>Activity Log</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {logsLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : logs.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">No activity yet</p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Action</TableHead>
                    <TableHead>Message</TableHead>
                    <TableHead className="text-right">Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {log.action.replace(/_/g, " ")}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-xs truncate">{log.message}</TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {new Date(log.createdAt).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Pagination
                page={logsPagination.page}
                totalPages={logsPagination.totalPages}
                onPageChange={setLogsPage}
              />
            </>
          )}
        </CardContent>
      </Card>

      <DeleteBotDialog
        open={showDelete}
        onOpenChange={setShowDelete}
        botName={bot.name}
        onConfirm={handleDelete}
      />
    </div>
  );
}
