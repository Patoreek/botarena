"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Swords } from "lucide-react";

import { useArenas } from "@/hooks/use-arenas";
import type { ArenaStatus } from "@repo/shared";
import { INTERVAL_LABELS, type RunInterval } from "@repo/shared";

import { Button } from "@/components/ui/button";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Pagination } from "@/components/ui/pagination";
import { ArenaStatusBadge } from "@/components/arena/arena-status-badge";

export default function ArenaPage() {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [statusFilter, setStatusFilter] = useState<string>("");

  const { arenas, pagination, loading } = useArenas({
    page,
    limit,
    status: statusFilter || undefined,
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Arena</h1>
          <p className="text-muted-foreground">Pit your bots against each other</p>
        </div>
        <Button asChild>
          <Link href="/arena/new">
            <Plus className="mr-2 h-4 w-4" />
            Create Arena
          </Link>
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
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
            <SelectItem value="RUNNING">Running</SelectItem>
            <SelectItem value="COMPLETED">Completed</SelectItem>
            <SelectItem value="STOPPED">Stopped</SelectItem>
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
      ) : arenas.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16">
          <Swords className="h-12 w-12 text-muted-foreground" />
          <h3 className="mt-4 text-lg font-semibold">No arenas yet</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Create your first arena to see your bots compete.
          </p>
          <Button asChild className="mt-4">
            <Link href="/arena/new">
              <Plus className="mr-2 h-4 w-4" />
              Create Arena
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
                  <TableHead>Exchange / Pair</TableHead>
                  <TableHead>Interval</TableHead>
                  <TableHead>Bots</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {arenas.map((arena) => (
                  <TableRow key={arena.id}>
                    <TableCell className="font-medium">
                      <Link href={`/arena/${arena.id}`} className="hover:underline">
                        {arena.name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      {arena.exchange} / {arena.marketPair}
                    </TableCell>
                    <TableCell>
                      {INTERVAL_LABELS[arena.interval as RunInterval] ?? arena.interval}
                    </TableCell>
                    <TableCell>{arena.entryCount}</TableCell>
                    <TableCell>
                      <ArenaStatusBadge status={arena.status as ArenaStatus} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(arena.createdAt).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Mobile cards */}
          <div className="space-y-3 md:hidden">
            {arenas.map((arena) => (
              <Link
                key={arena.id}
                href={`/arena/${arena.id}`}
                className="block rounded-lg border p-4 space-y-2 hover:bg-muted/50"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{arena.name}</span>
                  <ArenaStatusBadge status={arena.status as ArenaStatus} />
                </div>
                <div className="flex gap-4 text-sm text-muted-foreground">
                  <span>{arena.exchange} / {arena.marketPair}</span>
                  <span>{arena.entryCount} bots</span>
                </div>
              </Link>
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
