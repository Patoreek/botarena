"use client";

import { Badge } from "@/components/ui/badge";
import type { BotStatus } from "@repo/shared";

const statusConfig: Record<BotStatus, { label: string; variant: "default" | "success" | "warning" | "destructive" | "secondary" }> = {
  IDLE: { label: "Idle", variant: "secondary" },
  RUNNING: { label: "Running", variant: "success" },
  STOPPED: { label: "Stopped", variant: "warning" },
  ERROR: { label: "Error", variant: "destructive" },
};

export function BotStatusBadge({ status }: { status: BotStatus }) {
  const config = statusConfig[status];
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
