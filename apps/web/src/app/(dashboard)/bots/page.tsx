"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Eye, Pencil, Trash2, Bot, Archive, RotateCcw, ChevronDown, ChevronRight } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/lib/auth-context";
import { apiFetch } from "@/lib/api";
import { useBots } from "@/hooks/use-bots";
import type { BotListItem, BotStatus } from "@repo/shared";

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
import { BotStatusBadge } from "@/components/bots/bot-status-badge";
import { DeleteBotDialog } from "@/components/bots/delete-bot-dialog";

export default function BotsPage() {
  const router = useRouter();
  const { accessToken } = useAuth();
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [deleteTarget, setDeleteTarget] = useState<BotListItem | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [archivePage, setArchivePage] = useState(1);

  const { bots, pagination, loading, refetch } = useBots({
    page,
    limit,
    search: search || undefined,
    status: statusFilter || undefined,
  });

  const {
    bots: archivedBots,
    pagination: archivedPagination,
    loading: archivedLoading,
    refetch: refetchArchived,
  } = useBots({
    page: archivePage,
    limit: 10,
    archived: "true",
  });

  const handleDelete = async () => {
    if (!deleteTarget || !accessToken) return;
    try {
      await apiFetch(`/bots/${deleteTarget.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      toast.success(`"${deleteTarget.name}" deleted`);
      refetch();
      refetchArchived();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    }
  };

  const handleArchive = async (bot: BotListItem) => {
    if (!accessToken) return;
    try {
      await apiFetch(`/bots/${bot.id}/archive`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      toast.success(`"${bot.name}" archived`);
      refetch();
      refetchArchived();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Archive failed");
    }
  };

  const handleRestore = async (bot: BotListItem) => {
    if (!accessToken) return;
    try {
      await apiFetch(`/bots/${bot.id}/restore`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      toast.success(`"${bot.name}" restored`);
      refetch();
      refetchArchived();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Restore failed");
    }
  };

  const formatPnl = (value: number) => {
    const formatted = value.toFixed(2);
    if (value > 0) return <span className="text-emerald-600 dark:text-emerald-400">+{formatted}</span>;
    if (value < 0) return <span className="text-red-600 dark:text-red-400">{formatted}</span>;
    return <span className="text-muted-foreground">{formatted}</span>;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Bots</h1>
          <p className="text-muted-foreground">Manage your trading bots</p>
        </div>
        <Button asChild>
          <Link href="/bots/new">
            <Plus className="mr-2 h-4 w-4" />
            Create Bot
          </Link>
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Input
          placeholder="Search bots..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="sm:max-w-xs"
        />
        <Select
          value={statusFilter}
          onValueChange={(v) => {
            setStatusFilter(v === "ALL" ? "" : v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-full sm:w-[160px]">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All statuses</SelectItem>
            <SelectItem value="IDLE">Idle</SelectItem>
            <SelectItem value="RUNNING">Running</SelectItem>
            <SelectItem value="STOPPED">Stopped</SelectItem>
            <SelectItem value="ERROR">Error</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={String(limit)}
          onValueChange={(v) => {
            setLimit(Number(v));
            setPage(1);
          }}
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
      ) : bots.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16">
          <Bot className="h-12 w-12 text-muted-foreground" />
          <h3 className="mt-4 text-lg font-semibold">No bots yet</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Create your first trading bot to get started.
          </p>
          <Button asChild className="mt-4">
            <Link href="/bots/new">
              <Plus className="mr-2 h-4 w-4" />
              Create Bot
            </Link>
          </Button>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Strategy</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Net PnL</TableHead>
                  <TableHead className="text-right">Win Rate</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bots.map((bot) => (
                  <TableRow key={bot.id}>
                    <TableCell className="font-medium">
                      <Link href={`/bots/${bot.id}`} className="hover:underline">
                        {bot.name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{bot.strategy}</Badge>
                    </TableCell>
                    <TableCell>
                      <BotStatusBadge status={bot.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      {bot.stats ? formatPnl(bot.stats.netPnl) : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {bot.stats ? `${bot.stats.successRate.toFixed(1)}%` : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => router.push(`/bots/${bot.id}`)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => router.push(`/bots/${bot.id}/edit`)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-amber-600 hover:text-amber-600"
                          onClick={() => handleArchive(bot)}
                          title="Archive bot"
                        >
                          <Archive className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => setDeleteTarget(bot)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Mobile cards */}
          <div className="space-y-3 md:hidden">
            {bots.map((bot) => (
              <div key={bot.id} className="rounded-lg border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <Link href={`/bots/${bot.id}`} className="font-medium hover:underline">
                    {bot.name}
                  </Link>
                  <BotStatusBadge status={bot.status} />
                </div>
                <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                  <Badge variant="outline">{bot.strategy}</Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span>
                    PnL: {bot.stats ? formatPnl(bot.stats.netPnl) : "—"}
                  </span>
                  <span>Win Rate: {bot.stats ? `${bot.stats.successRate.toFixed(1)}%` : "—"}</span>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" asChild className="flex-1">
                    <Link href={`/bots/${bot.id}`}>View</Link>
                  </Button>
                  <Button variant="outline" size="sm" asChild className="flex-1">
                    <Link href={`/bots/${bot.id}/edit`}>Edit</Link>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-amber-600 hover:text-amber-600"
                    onClick={() => handleArchive(bot)}
                  >
                    <Archive className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setDeleteTarget(bot)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
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

      {/* Archived Bots Section */}
      <div className="border-t pt-6">
        <button
          className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => setShowArchived(!showArchived)}
        >
          {showArchived ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          <Archive className="h-4 w-4" />
          Archived Bots
          {archivedPagination.total > 0 && (
            <Badge variant="secondary" className="ml-1">{archivedPagination.total}</Badge>
          )}
        </button>

        {showArchived && (
          <div className="mt-4 space-y-3">
            {archivedLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : archivedBots.length === 0 ? (
              <div className="rounded-lg border border-dashed py-8 text-center">
                <Archive className="mx-auto h-8 w-8 text-muted-foreground" />
                <p className="mt-2 text-sm text-muted-foreground">No archived bots</p>
              </div>
            ) : (
              <>
                {/* Desktop table */}
                <div className="hidden md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Strategy</TableHead>
                        <TableHead className="text-right">Net PnL</TableHead>
                        <TableHead className="text-right">Archived</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {archivedBots.map((bot) => (
                        <TableRow key={bot.id} className="opacity-70">
                          <TableCell className="font-medium">{bot.name}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{bot.strategy}</Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {bot.stats ? formatPnl(bot.stats.netPnl) : "—"}
                          </TableCell>
                          <TableCell className="text-right text-xs text-muted-foreground">
                            {bot.archivedAt
                              ? new Date(bot.archivedAt).toLocaleDateString()
                              : "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => router.push(`/bots/${bot.id}`)}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-emerald-600 hover:text-emerald-600"
                                onClick={() => handleRestore(bot)}
                                title="Restore bot"
                              >
                                <RotateCcw className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive"
                                onClick={() => setDeleteTarget(bot)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Mobile cards */}
                <div className="space-y-3 md:hidden">
                  {archivedBots.map((bot) => (
                    <div key={bot.id} className="rounded-lg border p-4 space-y-3 opacity-70">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{bot.name}</span>
                        <Badge variant="secondary">Archived</Badge>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span>PnL: {bot.stats ? formatPnl(bot.stats.netPnl) : "—"}</span>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 text-emerald-600"
                          onClick={() => handleRestore(bot)}
                        >
                          <RotateCcw className="mr-1 h-4 w-4" />
                          Restore
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setDeleteTarget(bot)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                {archivedPagination.totalPages > 1 && (
                  <Pagination
                    page={archivedPagination.page}
                    totalPages={archivedPagination.totalPages}
                    onPageChange={setArchivePage}
                  />
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Delete Dialog */}
      <DeleteBotDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        botName={deleteTarget?.name ?? ""}
        onConfirm={handleDelete}
      />
    </div>
  );
}
