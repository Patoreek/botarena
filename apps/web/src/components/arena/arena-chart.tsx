"use client";

import { useMemo } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from "recharts";
import type { ArenaChartSeries } from "@/hooks/use-arenas";

const BOT_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];

interface ArenaChartProps {
  series: ArenaChartSeries[];
  loading?: boolean;
}

interface MergedPoint {
  time: string;
  label: string;
  [key: string]: number | string | null;
}

export function ArenaChart({ series, loading }: ArenaChartProps) {
  const { data, botNames } = useMemo(() => {
    if (!series.length) return { data: [], botNames: [] };

    const botNames = series.map((s) => s.botName);

    // Collect all timestamps and merge
    const timeMap = new Map<string, MergedPoint>();

    for (const s of series) {
      for (const p of s.points) {
        const t = new Date(p.time);
        const label = t.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
        const key = p.time;

        if (!timeMap.has(key)) {
          timeMap.set(key, { time: key, label });
        }
        const point = timeMap.get(key)!;
        point[s.botName] = p.pnl;
      }
    }

    // Sort by time and forward-fill missing values
    const sorted = Array.from(timeMap.values()).sort(
      (a, b) => new Date(a.time).getTime() - new Date(b.time).getTime()
    );

    // Forward fill
    const lastValues: Record<string, number> = {};
    for (const point of sorted) {
      for (const name of botNames) {
        if (point[name] != null) {
          lastValues[name] = point[name] as number;
        } else {
          point[name] = lastValues[name] ?? null;
        }
      }
    }

    // Sample if too many points
    const maxPoints = 300;
    let result = sorted;
    if (sorted.length > maxPoints) {
      const step = Math.ceil(sorted.length / maxPoints);
      result = sorted.filter((_, i) => i % step === 0 || i === sorted.length - 1);
    }

    return { data: result, botNames };
  }, [series]);

  if (loading) {
    return (
      <div className="flex h-80 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!data.length) {
    return (
      <div className="flex h-80 items-center justify-center rounded-lg border border-dashed text-muted-foreground">
        No chart data yet — waiting for ticks...
      </div>
    );
  }

  const allPnls = data.flatMap((d) =>
    botNames.map((name) => d[name] as number).filter((v) => v != null)
  );
  const minPnl = Math.min(...allPnls, 0);
  const maxPnl = Math.max(...allPnls, 0);
  const padding = Math.max(Math.abs(maxPnl - minPnl) * 0.2, 0.01);

  return (
    <div className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
            minTickGap={80}
          />
          <YAxis
            domain={[minPnl - padding, maxPnl + padding]}
            tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: number) => v.toFixed(3)}
            width={55}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "8px",
              fontSize: "12px",
              color: "hsl(var(--foreground))",
            }}
            formatter={(value: any, name: any) => [
              `${Number(value) >= 0 ? "+" : ""}${Number(value).toFixed(4)} USDT`,
              String(name),
            ]}
            labelFormatter={(label: any) => `Time: ${label}`}
          />
          <Legend />
          <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" opacity={0.4} />
          {botNames.map((name, i) => (
            <Line
              key={name}
              type="natural"
              dataKey={name}
              stroke={BOT_COLORS[i % BOT_COLORS.length]}
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
