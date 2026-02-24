"use client";

import { useAuth } from "@/lib/auth-context";
import { useWs } from "@/hooks/use-ws";
import { getWsUrl } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function DashboardPage() {
  const { user, accessToken } = useAuth();
  const wsUrl = accessToken ? getWsUrl(accessToken) : null;
  const { status, lastEvent } = useWs(wsUrl);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Welcome back{user?.name ? `, ${user.name}` : ""}.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>WebSocket</CardTitle>
          <CardDescription>Connection status and last event from the API.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm">
            Status:{" "}
            <span
              className={
                status === "open"
                  ? "text-green-600 dark:text-green-400"
                  : status === "connecting"
                    ? "text-yellow-600 dark:text-yellow-400"
                    : "text-muted-foreground"
              }
            >
              {status === "open"
                ? "Connected"
                : status === "connecting"
                  ? "Connecting..."
                  : "Disconnected"}
            </span>
          </p>
          {lastEvent && (
            <p className="text-sm text-muted-foreground">
              Last event: <code className="rounded bg-muted px-1">{lastEvent.type}</code>
              {lastEvent.payload != null ? (
                <span> — {JSON.stringify(lastEvent.payload)}</span>
              ) : null}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
