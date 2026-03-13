"use client";

import { useMemo, useState, useCallback, useRef } from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Scatter,
  Brush,
  ReferenceArea,
} from "recharts";
import type { ChartDataPoint } from "@/hooks/use-runs";

interface PerformanceChartProps {
  points: ChartDataPoint[];
  loading?: boolean;
}

interface ChartDatum {
  idx: number;
  time: number;
  label: string;
  price: number;
  pnl: number;
  portfolioValue: number | null;
  isBuy: boolean;
  isSell: boolean;
  buyMarker: number | null;
  sellMarker: number | null;
}

export function PerformanceChart({ points, loading }: PerformanceChartProps) {
  const [showBuys, setShowBuys] = useState(true);
  const [showSells, setShowSells] = useState(true);

  // Zoom state
  const [zoomLeft, setZoomLeft] = useState<string | null>(null);
  const [zoomRight, setZoomRight] = useState<string | null>(null);
  const [refAreaLeft, setRefAreaLeft] = useState<string | null>(null);
  const [refAreaRight, setRefAreaRight] = useState<string | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);

  const data = useMemo<ChartDatum[]>(() => {
    if (!points.length) return [];

    // Sample points if there are too many (keep every Nth + all trades)
    const maxPoints = 300;
    let sampled = points;
    if (points.length > maxPoints) {
      const step = Math.ceil(points.length / maxPoints);
      sampled = points.filter(
        (p, i) => i % step === 0 || p.action === "TRADE_BUY" || p.action === "TRADE_SELL"
      );
    }

    return sampled.map((p, i) => {
      const t = new Date(p.time);
      return {
        idx: i,
        time: t.getTime(),
        label: t.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
        price: p.price,
        pnl: p.pnl,
        portfolioValue: p.portfolioValue ?? null,
        isBuy: p.action === "TRADE_BUY",
        isSell: p.action === "TRADE_SELL",
        buyMarker: p.action === "TRADE_BUY" ? p.pnl : null,
        sellMarker: p.action === "TRADE_SELL" ? p.pnl : null,
      };
    });
  }, [points]);

  // Compute visible data for Y-axis domain
  const visibleData = useMemo(() => {
    if (!zoomLeft || !zoomRight) return data;
    return data.filter((d) => d.label >= zoomLeft && d.label <= zoomRight);
  }, [data, zoomLeft, zoomRight]);

  const resetZoom = useCallback(() => {
    setZoomLeft(null);
    setZoomRight(null);
  }, []);

  const handleMouseDown = useCallback((e: any) => {
    if (e?.activeLabel) {
      setRefAreaLeft(e.activeLabel);
      setIsSelecting(true);
    }
  }, []);

  const handleMouseMove = useCallback((e: any) => {
    if (isSelecting && e?.activeLabel) {
      setRefAreaRight(e.activeLabel);
    }
  }, [isSelecting]);

  const handleMouseUp = useCallback(() => {
    if (refAreaLeft && refAreaRight) {
      const [left, right] = [refAreaLeft, refAreaRight].sort();
      setZoomLeft(left);
      setZoomRight(right);
    }
    setRefAreaLeft(null);
    setRefAreaRight(null);
    setIsSelecting(false);
  }, [refAreaLeft, refAreaRight]);

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

  const displayData = visibleData.length > 0 ? visibleData : data;
  const minPnl = Math.min(...displayData.map((d) => d.pnl));
  const maxPnl = Math.max(...displayData.map((d) => d.pnl));
  const pnlPadding = Math.max(Math.abs(maxPnl - minPnl) * 0.2, 0.01);
  const isZoomed = zoomLeft !== null && zoomRight !== null;
  const lastPnl = data[data.length - 1]?.pnl ?? 0;

  return (
    <div className="space-y-3">
      {/* Controls bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ToggleButton
            active={showBuys}
            onClick={() => setShowBuys((v) => !v)}
            color="bg-blue-500"
            label="Buys"
          />
          <ToggleButton
            active={showSells}
            onClick={() => setShowSells((v) => !v)}
            color="bg-amber-500"
            label="Sells"
          />
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {isZoomed && (
            <button
              onClick={resetZoom}
              className="rounded-md border border-border bg-background px-2 py-1 text-xs font-medium hover:bg-muted transition-colors"
            >
              Reset Zoom
            </button>
          )}
          <span className="hidden sm:inline">Drag to zoom</span>
        </div>
      </div>

      {/* Chart */}
      <div className="h-80 w-full select-none">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={data}
            margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
          >
            <defs>
              <linearGradient id="pnlGradientPos" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity={0.25} />
                <stop offset="100%" stopColor="#10b981" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="pnlGradientNeg" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ef4444" stopOpacity={0.02} />
                <stop offset="100%" stopColor="#ef4444" stopOpacity={0.25} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
              minTickGap={80}
              domain={isZoomed ? [zoomLeft!, zoomRight!] : undefined}
              allowDataOverflow={isZoomed}
            />
            <YAxis
              domain={[minPnl - pnlPadding, maxPnl + pnlPadding]}
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
                boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
              }}
              formatter={(value: any, name: any) => {
                const v = Number(value);
                const n = String(name);
                if (n === "pnl") return [`${v >= 0 ? "+" : ""}${v.toFixed(4)} USDT`, "Cumulative PnL"];
                if (n === "buyMarker") return ["BUY", "Trade"];
                if (n === "sellMarker") return ["SELL", "Trade"];
                return [value, name];
              }}
              labelFormatter={(label: any) => `Time: ${label}`}
            />
            <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" opacity={0.4} />

            {/* PnL area fill */}
            <Area
              type="natural"
              dataKey="pnl"
              fill={lastPnl >= 0 ? "url(#pnlGradientPos)" : "url(#pnlGradientNeg)"}
              stroke="none"
              isAnimationActive={false}
              baseLine={0}
            />

            {/* PnL line — smooth "natural" spline */}
            <Line
              type="natural"
              dataKey="pnl"
              stroke={lastPnl >= 0 ? "#10b981" : "#ef4444"}
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />

            {/* Buy markers */}
            {showBuys && (
              <Scatter
                dataKey="buyMarker"
                fill="#3b82f6"
                shape={(props: any) => {
                  if (props.payload?.buyMarker === null) return null;
                  return (
                    <svg x={props.cx - 5} y={props.cy - 10} width={10} height={10}>
                      <polygon points="5,0 10,10 0,10" fill="#3b82f6" opacity={0.85} />
                    </svg>
                  );
                }}
                isAnimationActive={false}
              />
            )}

            {/* Sell markers */}
            {showSells && (
              <Scatter
                dataKey="sellMarker"
                fill="#f59e0b"
                shape={(props: any) => {
                  if (props.payload?.sellMarker === null) return null;
                  return (
                    <svg x={props.cx - 5} y={props.cy} width={10} height={10}>
                      <polygon points="5,10 10,0 0,0" fill="#f59e0b" opacity={0.85} />
                    </svg>
                  );
                }}
                isAnimationActive={false}
              />
            )}

            {/* Zoom selection area */}
            {refAreaLeft && refAreaRight && (
              <ReferenceArea
                x1={refAreaLeft}
                x2={refAreaRight}
                strokeOpacity={0.3}
                fill="hsl(var(--primary))"
                fillOpacity={0.1}
              />
            )}

            {/* Scrollable brush at bottom */}
            <Brush
              dataKey="label"
              height={28}
              stroke="hsl(var(--border))"
              fill="hsl(var(--card))"
              travellerWidth={8}
              startIndex={isZoomed ? data.findIndex((d) => d.label === zoomLeft) : undefined}
              endIndex={isZoomed ? data.findIndex((d) => d.label === zoomRight) : undefined}
            >
              <ComposedChart data={data}>
                <Line
                  type="natural"
                  dataKey="pnl"
                  stroke={lastPnl >= 0 ? "#10b981" : "#ef4444"}
                  strokeWidth={1}
                  dot={false}
                  isAnimationActive={false}
                />
              </ComposedChart>
            </Brush>
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/* ── Toggle Button ────────────────────────────────────────────────────────── */

function ToggleButton({
  active,
  onClick,
  color,
  label,
}: {
  active: boolean;
  onClick: () => void;
  color: string;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`
        inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-all
        ${active
          ? "border-border bg-background text-foreground"
          : "border-transparent bg-muted/50 text-muted-foreground line-through opacity-60"
        }
        hover:bg-muted
      `}
    >
      <span className={`inline-block h-2 w-2 rounded-full ${active ? color : "bg-muted-foreground/40"}`} />
      {label}
    </button>
  );
}
