import { z } from "zod";
import { apiProvider } from "./api-key";
import { paginationMeta } from "./bot";

export const runStatus = z.enum(["PENDING", "RUNNING", "PAUSED", "STOPPED", "COMPLETED", "ERROR"]);
export type RunStatus = z.infer<typeof runStatus>;

export const runInterval = z.enum([
  "ONE_SECOND",
  "FIVE_SECONDS",
  "FIFTEEN_SECONDS",
  "THIRTY_SECONDS",
  "ONE_MINUTE",
  "FIVE_MINUTES",
  "FIFTEEN_MINUTES",
  "THIRTY_MINUTES",
  "ONE_HOUR",
  "FOUR_HOURS",
  "ONE_DAY",
]);
export type RunInterval = z.infer<typeof runInterval>;

export const runLogAction = z.enum([
  "RUN_START",
  "RUN_PAUSE",
  "RUN_RESUME",
  "RUN_STOP",
  "RUN_COMPLETE",
  "RUN_ERROR",
  "TRADE_BUY",
  "TRADE_SELL",
  "CONFIG_CHANGE",
  "TICK",
]);
export type RunLogAction = z.infer<typeof runLogAction>;

export const INTERVAL_LABELS: Record<RunInterval, string> = {
  ONE_SECOND: "1s",
  FIVE_SECONDS: "5s",
  FIFTEEN_SECONDS: "15s",
  THIRTY_SECONDS: "30s",
  ONE_MINUTE: "1m",
  FIVE_MINUTES: "5m",
  FIFTEEN_MINUTES: "15m",
  THIRTY_MINUTES: "30m",
  ONE_HOUR: "1h",
  FOUR_HOURS: "4h",
  ONE_DAY: "1d",
};

export const INTERVAL_MS: Record<RunInterval, number> = {
  ONE_SECOND: 1_000,
  FIVE_SECONDS: 5_000,
  FIFTEEN_SECONDS: 15_000,
  THIRTY_SECONDS: 30_000,
  ONE_MINUTE: 60_000,
  FIVE_MINUTES: 300_000,
  FIFTEEN_MINUTES: 900_000,
  THIRTY_MINUTES: 1_800_000,
  ONE_HOUR: 3_600_000,
  FOUR_HOURS: 14_400_000,
  ONE_DAY: 86_400_000,
};

export const klineSchema = z.object({
  openTime: z.number(),
  open: z.string(),
  high: z.string(),
  low: z.string(),
  close: z.string(),
  volume: z.string(),
  closeTime: z.number(),
  quoteVolume: z.string(),
  trades: z.number(),
});
export type Kline = z.infer<typeof klineSchema>;

export const marketDataResponse = z.object({
  symbol: z.string(),
  lastPrice: z.string(),
  priceChange: z.string(),
  priceChangePercent: z.string(),
  highPrice: z.string(),
  lowPrice: z.string(),
  volume: z.string(),
  quoteVolume: z.string(),
  openPrice: z.string(),
  klines: z.array(klineSchema),
  fetchedAt: z.string(),
});
export type MarketDataResponse = z.infer<typeof marketDataResponse>;

export const TOP_MARKET_PAIRS = [
  "BTC/USDT",
  "ETH/USDT",
  "BNB/USDT",
  "SOL/USDT",
  "XRP/USDT",
  "DOGE/USDT",
  "ADA/USDT",
  "AVAX/USDT",
  "DOT/USDT",
  "LINK/USDT",
  "MATIC/USDT",
  "SHIB/USDT",
  "LTC/USDT",
  "UNI/USDT",
  "ATOM/USDT",
  "FIL/USDT",
  "APT/USDT",
  "ARB/USDT",
  "OP/USDT",
  "NEAR/USDT",
];

// --- Create run ---

export const createRunBody = z.object({
  exchange: apiProvider,
  marketPair: z
    .string()
    .min(1)
    .max(20)
    .transform((v) => v.replace("/", "").toUpperCase()),
  interval: runInterval,
});
export type CreateRunBody = z.infer<typeof createRunBody>;

// --- Update run status ---

export const updateRunStatusBody = z.object({
  status: z.enum(["RUNNING", "PAUSED", "STOPPED"]),
});
export type UpdateRunStatusBody = z.infer<typeof updateRunStatusBody>;

export const tickDecision = z.enum(["BUY", "SELL", "HOLD"]);
export type TickDecision = z.infer<typeof tickDecision>;

export const tickMetadata = z.object({
  price: z.number(),
  decision: tickDecision,
  reason: z.string(),
  position: z.string().optional(),
  gridLevel: z.string().optional(),
  confidence: z.number().optional(),
});
export type TickMetadata = z.infer<typeof tickMetadata>;

// --- Response schemas ---

export const runStatsSchema = z.object({
  totalProfit: z.number(),
  totalLoss: z.number(),
  netPnl: z.number(),
  totalBuys: z.number(),
  totalSells: z.number(),
  totalTrades: z.number(),
  winCount: z.number(),
  lossCount: z.number(),
  roi: z.number(),
});
export type RunStats = z.infer<typeof runStatsSchema>;

export const runResponseSchema = z.object({
  id: z.string(),
  botId: z.string(),
  exchange: apiProvider,
  marketPair: z.string(),
  interval: runInterval,
  status: runStatus,
  startedAt: z.string().nullable(),
  stoppedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  stats: runStatsSchema,
});
export type RunResponse = z.infer<typeof runResponseSchema>;

export const runListResponse = z.object({
  items: z.array(runResponseSchema),
  pagination: paginationMeta,
});
export type RunListResponse = z.infer<typeof runListResponse>;

// --- Query params ---

export const runListQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  status: runStatus.optional(),
});
export type RunListQuery = z.infer<typeof runListQuery>;

// --- Log schemas ---

export const runLogEntry = z.object({
  id: z.string(),
  action: runLogAction,
  message: z.string(),
  metadata: z.unknown().nullable(),
  createdAt: z.string(),
});
export type RunLogEntry = z.infer<typeof runLogEntry>;

export const runLogListQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type RunLogListQuery = z.infer<typeof runLogListQuery>;

export const runLogListResponse = z.object({
  items: z.array(runLogEntry),
  pagination: paginationMeta,
});
export type RunLogListResponse = z.infer<typeof runLogListResponse>;
