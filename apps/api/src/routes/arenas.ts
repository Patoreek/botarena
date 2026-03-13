import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type { AuthenticatedRequest } from "../plugins/auth.js";
import { prisma } from "../lib/db.js";
import {
  createArenaBody,
  updateArenaStatusBody,
  arenaListQuery,
  runLogListQuery,
  type RunInterval,
} from "@repo/shared";
import type { Prisma } from "@prisma/client";
import { runManager } from "../lib/engine/manager.js";
import { arenaManager } from "../lib/engine/arena-manager.js";
import type { GridConfig } from "../lib/engine/grid.js";

function serializeDate(d: Date): string {
  return d.toISOString();
}

export async function arenaRoutes(fastify: FastifyInstance) {
  // GET /arenas - list user's arenas
  fastify.get(
    "/arenas",
    { preHandler: [fastify.authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const req = request as AuthenticatedRequest;
      const parsed = arenaListQuery.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Invalid query", details: parsed.error.flatten() });
      }

      const { page, limit, status } = parsed.data;
      const where: Prisma.ArenaWhereInput = { userId: req.user.id };
      if (status) where.status = status;

      const [items, total] = await Promise.all([
        prisma.arena.findMany({
          where,
          include: { _count: { select: { entries: true } } },
          orderBy: { createdAt: "desc" },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.arena.count({ where }),
      ]);

      return {
        items: items.map((arena) => ({
          id: arena.id,
          name: arena.name,
          exchange: arena.exchange,
          marketPair: arena.marketPair,
          interval: arena.interval,
          durationHours: arena.durationHours,
          status: arena.status,
          entryCount: arena._count.entries,
          startedAt: arena.startedAt ? serializeDate(arena.startedAt) : null,
          stoppedAt: arena.stoppedAt ? serializeDate(arena.stoppedAt) : null,
          createdAt: serializeDate(arena.createdAt),
        })),
        pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
      };
    }
  );

  // POST /arenas - create and start a new arena
  fastify.post(
    "/arenas",
    { preHandler: [fastify.authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const req = request as AuthenticatedRequest;
      const parsed = createArenaBody.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Validation failed", details: parsed.error.flatten() });
      }

      const { name, exchange, marketPair, interval, durationHours, botIds } = parsed.data;

      // Verify API key exists
      const apiKey = await prisma.apiKey.findUnique({
        where: { userId_provider: { userId: req.user.id, provider: exchange } },
      });
      if (!apiKey) {
        return reply.status(400).send({ error: `No ${exchange} API key configured. Add one in Settings > Integrations.` });
      }

      // Verify all bots belong to user and have grid configs
      const bots = await prisma.bot.findMany({
        where: { id: { in: botIds }, userId: req.user.id },
        include: { gridConfig: true },
      });

      if (bots.length !== botIds.length) {
        return reply.status(400).send({ error: "One or more bots not found" });
      }

      const botsWithoutConfig = bots.filter((b) => !b.gridConfig);
      if (botsWithoutConfig.length > 0) {
        return reply.status(400).send({
          error: `Bots missing grid config: ${botsWithoutConfig.map((b) => b.name).join(", ")}`,
        });
      }

      // Create the arena
      const arena = await prisma.arena.create({
        data: {
          userId: req.user.id,
          name,
          exchange,
          marketPair,
          interval,
          durationHours,
          status: "RUNNING",
          startedAt: new Date(),
        },
      });

      // Create a BotRun and ArenaEntry for each bot
      const runIds: string[] = [];
      const entries = [];

      for (const bot of bots) {
        const run = await prisma.botRun.create({
          data: {
            botId: bot.id,
            exchange,
            marketPair,
            interval,
            durationHours,
            status: "RUNNING",
            startedAt: new Date(),
          },
        });

        await prisma.runLog.create({
          data: {
            runId: run.id,
            action: "RUN_START",
            message: `Arena "${name}" started: ${bot.name} on ${exchange} ${marketPair} (${interval})`,
          },
        });

        const entry = await prisma.arenaEntry.create({
          data: {
            arenaId: arena.id,
            botId: bot.id,
            botRunId: run.id,
          },
        });

        // Start the engine
        const gridConfig = bot.gridConfig!;
        const engineConfig: GridConfig = {
          upperPrice: gridConfig.upperPrice,
          lowerPrice: gridConfig.lowerPrice,
          gridCount: gridConfig.gridCount,
          gridType: gridConfig.gridType as "ARITHMETIC" | "GEOMETRIC",
          gridMode: gridConfig.gridMode as "LONG" | "SHORT" | "NEUTRAL",
          amountPerGrid: gridConfig.amountPerGrid,
          totalInvestment: gridConfig.totalInvestment,
          minProfitPerGrid: gridConfig.minProfitPerGrid ?? undefined,
          maxOpenOrders: gridConfig.maxOpenOrders ?? undefined,
        };

        runManager.start({
          runId: run.id,
          botId: bot.id,
          marketPair,
          interval: interval as RunInterval,
          gridConfig: engineConfig,
          durationMs: durationHours * 60 * 60 * 1000,
        });

        await prisma.bot.update({
          where: { id: bot.id },
          data: { status: "RUNNING" },
        });

        runIds.push(run.id);
        entries.push({
          id: entry.id,
          botId: bot.id,
          botRunId: run.id,
          botName: bot.name,
          botStrategy: bot.strategy,
          rank: null,
          stats: {
            totalProfit: 0,
            totalLoss: 0,
            netPnl: 0,
            totalBuys: 0,
            totalSells: 0,
            totalTrades: 0,
            winCount: 0,
            lossCount: 0,
            roi: 0,
          },
          runStatus: "RUNNING" as const,
        });
      }

      // Track arena for completion detection
      arenaManager.track(arena.id, runIds);

      return reply.status(201).send({
        id: arena.id,
        name: arena.name,
        exchange: arena.exchange,
        marketPair: arena.marketPair,
        interval: arena.interval,
        durationHours: arena.durationHours,
        status: arena.status,
        startedAt: arena.startedAt ? serializeDate(arena.startedAt) : null,
        stoppedAt: null,
        createdAt: serializeDate(arena.createdAt),
        updatedAt: serializeDate(arena.updatedAt),
        entries,
      });
    }
  );

  // GET /arenas/:arenaId - get arena detail with leaderboard
  fastify.get(
    "/arenas/:arenaId",
    { preHandler: [fastify.authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const req = request as AuthenticatedRequest;
      const { arenaId } = request.params as { arenaId: string };

      const arena = await prisma.arena.findUnique({
        where: { id: arenaId },
        include: {
          entries: {
            include: {
              bot: { select: { name: true, strategy: true } },
              botRun: true,
            },
          },
        },
      });

      if (!arena || arena.userId !== req.user.id) {
        return reply.status(404).send({ error: "Arena not found" });
      }

      // Sort entries by netPnl descending (leaderboard)
      const sortedEntries = [...arena.entries].sort(
        (a, b) => b.botRun.netPnl - a.botRun.netPnl
      );

      return {
        id: arena.id,
        name: arena.name,
        exchange: arena.exchange,
        marketPair: arena.marketPair,
        interval: arena.interval,
        durationHours: arena.durationHours,
        status: arena.status,
        startedAt: arena.startedAt ? serializeDate(arena.startedAt) : null,
        stoppedAt: arena.stoppedAt ? serializeDate(arena.stoppedAt) : null,
        createdAt: serializeDate(arena.createdAt),
        updatedAt: serializeDate(arena.updatedAt),
        entries: sortedEntries.map((entry, idx) => ({
          id: entry.id,
          botId: entry.botId,
          botRunId: entry.botRunId,
          botName: entry.bot.name,
          botStrategy: entry.bot.strategy,
          rank: entry.rank ?? idx + 1,
          stats: {
            totalProfit: entry.botRun.totalProfit,
            totalLoss: entry.botRun.totalLoss,
            netPnl: entry.botRun.netPnl,
            totalBuys: entry.botRun.totalBuys,
            totalSells: entry.botRun.totalSells,
            totalTrades: entry.botRun.totalTrades,
            winCount: entry.botRun.winCount,
            lossCount: entry.botRun.lossCount,
            roi: entry.botRun.roi,
          },
          runStatus: entry.botRun.status,
        })),
      };
    }
  );

  // PATCH /arenas/:arenaId/status - stop an arena
  fastify.patch(
    "/arenas/:arenaId/status",
    { preHandler: [fastify.authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const req = request as AuthenticatedRequest;
      const { arenaId } = request.params as { arenaId: string };

      const arena = await prisma.arena.findUnique({
        where: { id: arenaId },
        include: { entries: { include: { botRun: true } } },
      });

      if (!arena || arena.userId !== req.user.id) {
        return reply.status(404).send({ error: "Arena not found" });
      }

      const parsed = updateArenaStatusBody.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Validation failed", details: parsed.error.flatten() });
      }

      if (arena.status !== "RUNNING") {
        return reply.status(400).send({ error: `Cannot stop arena in ${arena.status} state` });
      }

      // Stop all running entries
      for (const entry of arena.entries) {
        if (entry.botRun.status === "RUNNING" || entry.botRun.status === "PAUSED") {
          await runManager.stop(entry.botRunId);

          await prisma.botRun.update({
            where: { id: entry.botRunId },
            data: { status: "STOPPED", stoppedAt: new Date() },
          });

          await prisma.runLog.create({
            data: {
              runId: entry.botRunId,
              action: "RUN_STOP",
              message: "Arena stopped by user",
            },
          });

          // Reset bot status if no other active runs
          const activeRuns = await prisma.botRun.count({
            where: { botId: entry.botId, status: { in: ["RUNNING", "PAUSED"] } },
          });
          if (activeRuns === 0) {
            await prisma.bot.update({
              where: { id: entry.botId },
              data: { status: "IDLE" },
            });
          }
        }
      }

      // Assign ranks based on current performance
      const entries = await prisma.arenaEntry.findMany({
        where: { arenaId },
        include: { botRun: { select: { netPnl: true } } },
      });
      entries.sort((a, b) => b.botRun.netPnl - a.botRun.netPnl);
      for (let i = 0; i < entries.length; i++) {
        await prisma.arenaEntry.update({
          where: { id: entries[i].id },
          data: { rank: i + 1 },
        });
      }

      await arenaManager.stopArena(arenaId);

      const updated = await prisma.arena.update({
        where: { id: arenaId },
        data: { status: "STOPPED", stoppedAt: new Date() },
      });

      return { status: updated.status };
    }
  );

  // GET /arenas/:arenaId/entries/:entryId/logs - paginated entry logs
  fastify.get(
    "/arenas/:arenaId/entries/:entryId/logs",
    { preHandler: [fastify.authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const req = request as AuthenticatedRequest;
      const { arenaId, entryId } = request.params as { arenaId: string; entryId: string };

      const arena = await prisma.arena.findUnique({ where: { id: arenaId } });
      if (!arena || arena.userId !== req.user.id) {
        return reply.status(404).send({ error: "Arena not found" });
      }

      const entry = await prisma.arenaEntry.findUnique({ where: { id: entryId } });
      if (!entry || entry.arenaId !== arenaId) {
        return reply.status(404).send({ error: "Entry not found" });
      }

      const parsed = runLogListQuery.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Invalid query", details: parsed.error.flatten() });
      }

      const { page, limit } = parsed.data;
      const where = { runId: entry.botRunId };

      const [items, total] = await Promise.all([
        prisma.runLog.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.runLog.count({ where }),
      ]);

      return {
        items: items.map((log) => ({
          id: log.id,
          action: log.action,
          message: log.message,
          metadata: log.metadata,
          createdAt: serializeDate(log.createdAt),
        })),
        pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
      };
    }
  );

  // GET /arenas/:arenaId/chart - multi-line chart data for all entries
  fastify.get(
    "/arenas/:arenaId/chart",
    { preHandler: [fastify.authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const req = request as AuthenticatedRequest;
      const { arenaId } = request.params as { arenaId: string };

      const arena = await prisma.arena.findUnique({
        where: { id: arenaId },
        include: {
          entries: {
            include: {
              bot: { select: { name: true } },
              botRun: { select: { id: true } },
            },
          },
        },
      });

      if (!arena || arena.userId !== req.user.id) {
        return reply.status(404).send({ error: "Arena not found" });
      }

      // Fetch chart data for each entry
      const series = await Promise.all(
        arena.entries.map(async (entry) => {
          const logs = await prisma.runLog.findMany({
            where: {
              runId: entry.botRunId,
              action: { in: ["TICK", "TRADE_BUY", "TRADE_SELL"] },
            },
            orderBy: { createdAt: "asc" },
            select: { action: true, metadata: true, createdAt: true },
          });

          let cumulativePnl = 0;
          const points: Array<{ time: string; pnl: number; price: number }> = [];

          for (const log of logs) {
            const meta = log.metadata as Record<string, any> | null;
            if (!meta) continue;

            const price = meta.price ?? 0;
            if (log.action === "TRADE_SELL" && meta.pnl !== undefined) {
              cumulativePnl += meta.pnl;
            }

            points.push({
              time: serializeDate(log.createdAt),
              pnl: cumulativePnl,
              price,
            });
          }

          return {
            entryId: entry.id,
            botName: entry.bot.name,
            botId: entry.botId,
            points,
          };
        })
      );

      return { series };
    }
  );
}
