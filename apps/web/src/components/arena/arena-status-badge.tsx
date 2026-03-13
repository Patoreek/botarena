import { Badge } from "@/components/ui/badge";
import type { ArenaStatus } from "@repo/shared";

const statusConfig: Record<ArenaStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  PENDING: { label: "Pending", variant: "outline" },
  RUNNING: { label: "Running", variant: "default" },
  COMPLETED: { label: "Completed", variant: "secondary" },
  STOPPED: { label: "Stopped", variant: "outline" },
  ERROR: { label: "Error", variant: "destructive" },
};

export function ArenaStatusBadge({ status }: { status: ArenaStatus }) {
  const config = statusConfig[status] ?? { label: status, variant: "outline" as const };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
