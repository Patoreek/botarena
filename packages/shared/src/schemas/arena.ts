import { z } from "zod";
import { apiProvider } from "./api-key";
import { paginationMeta } from "./bot";
import { runInterval, runStatsSchema, runStatus } from "./run";

export const arenaStatus = z.enum(["PENDING", "RUNNING", "COMPLETED", "STOPPED", "ERROR"]);
export type ArenaStatus = z.infer<typeof arenaStatus>;

// --- Create arena ---

export const createArenaBody = z.object({
  name: z.string().min(1).max(100),
  exchange: apiProvider,
  marketPair: z
    .string()
    .min(1)
    .max(20)
    .transform((v) => v.replace("/", "").toUpperCase()),
  interval: runInterval,
  durationHours: z.number().int().min(1).max(24),
  botIds: z.array(z.string()).min(2).max(5),
});
export type CreateArenaBody = z.infer<typeof createArenaBody>;

// --- Update arena status ---

export const updateArenaStatusBody = z.object({
  status: z.enum(["STOPPED"]),
});
export type UpdateArenaStatusBody = z.infer<typeof updateArenaStatusBody>;

// --- Response schemas ---

export const arenaEntrySchema = z.object({
  id: z.string(),
  botId: z.string(),
  botRunId: z.string(),
  botName: z.string(),
  botStrategy: z.string(),
  rank: z.number().nullable(),
  stats: runStatsSchema,
  runStatus: runStatus,
});
export type ArenaEntry = z.infer<typeof arenaEntrySchema>;

export const arenaResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  exchange: apiProvider,
  marketPair: z.string(),
  interval: runInterval,
  durationHours: z.number(),
  status: arenaStatus,
  startedAt: z.string().nullable(),
  stoppedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  entries: z.array(arenaEntrySchema),
});
export type ArenaResponse = z.infer<typeof arenaResponseSchema>;

// --- List schemas ---

export const arenaListItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  exchange: apiProvider,
  marketPair: z.string(),
  interval: runInterval,
  durationHours: z.number(),
  status: arenaStatus,
  entryCount: z.number(),
  startedAt: z.string().nullable(),
  stoppedAt: z.string().nullable(),
  createdAt: z.string(),
});
export type ArenaListItem = z.infer<typeof arenaListItemSchema>;

export const arenaListQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  status: arenaStatus.optional(),
});
export type ArenaListQuery = z.infer<typeof arenaListQuery>;

export const arenaListResponse = z.object({
  items: z.array(arenaListItemSchema),
  pagination: paginationMeta,
});
export type ArenaListResponse = z.infer<typeof arenaListResponse>;
