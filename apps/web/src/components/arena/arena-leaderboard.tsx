"use client";

import type { ArenaEntry } from "@repo/shared";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { RunStatusBadge } from "@/components/bots/run-status-badge";

const RANK_STYLES: Record<number, string> = {
  1: "text-amber-500 font-bold",
  2: "text-gray-400 font-semibold",
  3: "text-orange-600 font-semibold",
};

interface ArenaLeaderboardProps {
  entries: ArenaEntry[];
}

export function ArenaLeaderboard({ entries }: ArenaLeaderboardProps) {
  const formatPnl = (value: number) => {
    const formatted = value.toFixed(4);
    if (value > 0) return <span className="text-emerald-600 dark:text-emerald-400">+{formatted}</span>;
    if (value < 0) return <span className="text-red-600 dark:text-red-400">{formatted}</span>;
    return <span className="text-muted-foreground">{formatted}</span>;
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-16">Rank</TableHead>
          <TableHead>Bot</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Net PnL</TableHead>
          <TableHead className="text-right">ROI</TableHead>
          <TableHead className="text-right">Trades</TableHead>
          <TableHead className="text-right">Win Rate</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {entries.map((entry) => {
          const winRate = entry.stats.totalTrades > 0
            ? ((entry.stats.winCount / entry.stats.totalTrades) * 100).toFixed(1)
            : "0.0";
          return (
            <TableRow key={entry.id}>
              <TableCell>
                <span className={RANK_STYLES[entry.rank ?? 0] ?? "text-muted-foreground"}>
                  #{entry.rank ?? "—"}
                </span>
              </TableCell>
              <TableCell className="font-medium">
                {entry.botName}
                <Badge variant="outline" className="ml-2 text-xs">
                  {entry.botStrategy}
                </Badge>
              </TableCell>
              <TableCell>
                <RunStatusBadge status={entry.runStatus} />
              </TableCell>
              <TableCell className="text-right">{formatPnl(entry.stats.netPnl)}</TableCell>
              <TableCell className="text-right">{entry.stats.roi.toFixed(2)}%</TableCell>
              <TableCell className="text-right">{entry.stats.totalTrades}</TableCell>
              <TableCell className="text-right">{winRate}%</TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
