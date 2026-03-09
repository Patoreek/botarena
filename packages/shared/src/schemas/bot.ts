import { z } from "zod";

export const botStrategy = z.enum(["GRID"]);
export type BotStrategy = z.infer<typeof botStrategy>;

export const botStatus = z.enum(["IDLE", "RUNNING", "STOPPED", "ERROR"]);
export type BotStatus = z.infer<typeof botStatus>;

export const gridType = z.enum(["ARITHMETIC", "GEOMETRIC"]);
export type GridType = z.infer<typeof gridType>;

export const botLogAction = z.enum([
  "TRADE_BUY",
  "TRADE_SELL",
  "BOT_START",
  "BOT_STOP",
  "BOT_ERROR",
  "CONFIG_CHANGE",
  "MANUAL",
]);
export type BotLogAction = z.infer<typeof botLogAction>;

// --- Grid strategy config ---

export const gridStrategyConfigSchema = z.object({
  upperPrice: z.number().positive(),
  lowerPrice: z.number().positive(),
  gridCount: z.number().int().min(2).max(500),
  gridType: gridType.default("ARITHMETIC"),
  totalInvestment: z.number().positive(),
  amountPerGrid: z.number().positive(),
  takeProfitPrice: z.number().positive().optional(),
  stopLossPrice: z.number().positive().optional(),
});
export type GridStrategyConfig = z.infer<typeof gridStrategyConfigSchema>;

// --- Create / Update bodies ---

export const createBotBody = z
  .object({
    name: z.string().min(1).max(100),
    strategy: botStrategy,
    exchange: z.string().min(1).max(50),
    tradingPair: z.string().min(1).max(20),
    gridConfig: gridStrategyConfigSchema,
  })
  .refine((d) => d.gridConfig.upperPrice > d.gridConfig.lowerPrice, {
    message: "Upper price must be greater than lower price",
    path: ["gridConfig", "upperPrice"],
  });
export type CreateBotBody = z.infer<typeof createBotBody>;

export const updateBotBody = z
  .object({
    name: z.string().min(1).max(100).optional(),
    exchange: z.string().min(1).max(50).optional(),
    tradingPair: z.string().min(1).max(20).optional(),
    gridConfig: gridStrategyConfigSchema.partial().optional(),
  })
  .refine(
    (d) => {
      if (d.gridConfig?.upperPrice != null && d.gridConfig?.lowerPrice != null) {
        return d.gridConfig.upperPrice > d.gridConfig.lowerPrice;
      }
      return true;
    },
    { message: "Upper price must be greater than lower price", path: ["gridConfig", "upperPrice"] }
  );
export type UpdateBotBody = z.infer<typeof updateBotBody>;

export const updateBotStatusBody = z.object({
  status: z.enum(["RUNNING", "STOPPED"]),
});
export type UpdateBotStatusBody = z.infer<typeof updateBotStatusBody>;

// --- Response schemas ---

export const botStatsSchema = z.object({
  totalProfit: z.number(),
  totalLoss: z.number(),
  netPnl: z.number(),
  totalBuys: z.number(),
  totalSells: z.number(),
  totalTrades: z.number(),
  winCount: z.number(),
  lossCount: z.number(),
  successRate: z.number(),
  maxDrawdown: z.number(),
  roi: z.number(),
  lastUpdatedAt: z.string(),
});
export type BotStatsResponse = z.infer<typeof botStatsSchema>;

export const gridConfigResponseSchema = z.object({
  upperPrice: z.number(),
  lowerPrice: z.number(),
  gridCount: z.number(),
  gridType: gridType,
  totalInvestment: z.number(),
  amountPerGrid: z.number(),
  takeProfitPrice: z.number().nullable(),
  stopLossPrice: z.number().nullable(),
});
export type GridConfigResponse = z.infer<typeof gridConfigResponseSchema>;

export const botResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  strategy: botStrategy,
  status: botStatus,
  exchange: z.string(),
  tradingPair: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  stats: botStatsSchema.nullable(),
  gridConfig: gridConfigResponseSchema.nullable(),
});
export type BotResponse = z.infer<typeof botResponseSchema>;

export const botListItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  strategy: botStrategy,
  status: botStatus,
  exchange: z.string(),
  tradingPair: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  stats: botStatsSchema.nullable(),
});
export type BotListItem = z.infer<typeof botListItemSchema>;

export const paginationMeta = z.object({
  total: z.number(),
  page: z.number(),
  limit: z.number(),
  totalPages: z.number(),
});
export type PaginationMeta = z.infer<typeof paginationMeta>;

export const botListResponse = z.object({
  items: z.array(botListItemSchema),
  pagination: paginationMeta,
});
export type BotListResponse = z.infer<typeof botListResponse>;

// --- Query params ---

export const botListQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().optional(),
  status: botStatus.optional(),
  sortBy: z.enum(["name", "createdAt", "updatedAt", "status"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});
export type BotListQuery = z.infer<typeof botListQuery>;

// --- Log schemas ---

export const botLogEntry = z.object({
  id: z.string(),
  action: botLogAction,
  message: z.string(),
  metadata: z.unknown().nullable(),
  createdAt: z.string(),
});
export type BotLogEntry = z.infer<typeof botLogEntry>;

export const botLogListQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type BotLogListQuery = z.infer<typeof botLogListQuery>;

export const botLogListResponse = z.object({
  items: z.array(botLogEntry),
  pagination: paginationMeta,
});
export type BotLogListResponse = z.infer<typeof botLogListResponse>;
