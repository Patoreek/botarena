import { Badge } from "@/components/ui/badge";
import type { RunStatus } from "@repo/shared";

const statusConfig: Record<RunStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  PENDING: { label: "Pending", variant: "outline" },
  RUNNING: { label: "Running", variant: "default" },
  PAUSED: { label: "Paused", variant: "secondary" },
  STOPPED: { label: "Stopped", variant: "outline" },
  COMPLETED: { label: "Completed", variant: "secondary" },
  ERROR: { label: "Error", variant: "destructive" },
};

export function RunStatusBadge({ status }: { status: RunStatus }) {
  const config = statusConfig[status] ?? { label: status, variant: "outline" as const };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
