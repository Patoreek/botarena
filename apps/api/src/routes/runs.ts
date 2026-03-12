import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type { AuthenticatedRequest } from "../plugins/auth.js";
import { prisma } from "../lib/db.js";
import {
  createRunBody,
  updateRunStatusBody,
  runListQuery,
  runLogListQuery,
  allRunsListQuery,
  type RunInterval,
} from "@repo/shared";
import type { Prisma } from "@prisma/client";
import { fetchKlines, fetchTicker, toSymbol } from "../lib/binance.js";
import { runManager } from "../lib/engine/manager.js";
import type { GridConfig } from "../lib/engine/grid.js";

function serializeDate(d: Date): string {
  return d.toISOString();
}

function serializeRun(run: any) {
  return {
    id: run.id,
    botId: run.botId,
    exchange: run.exchange,
    marketPair: run.marketPair,
    interval: run.interval,
    durationHours: run.durationHours,
    status: run.status,
    startedAt: run.startedAt ? serializeDate(run.startedAt) : null,
    stoppedAt: run.stoppedAt ? serializeDate(run.stoppedAt) : null,
    createdAt: serializeDate(run.createdAt),
    updatedAt: serializeDate(run.updatedAt),
    stats: {
      totalProfit: run.totalProfit,
      totalLoss: run.totalLoss,
      netPnl: run.netPnl,
      totalBuys: run.totalBuys,
      totalSells: run.totalSells,
      totalTrades: run.totalTrades,
      winCount: run.winCount,
      lossCount: run.lossCount,
      roi: run.roi,
    },
  };
}

export async function runRoutes(fastify: FastifyInstance) {
  // GET /bots/:botId/runs - list runs for a bot
  fastify.get(
    "/bots/:botId/runs",
    { preHandler: [fastify.authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const req = request as AuthenticatedRequest;
      const { botId } = request.params as { botId: string };

      const bot = await prisma.bot.findUnique({ where: { id: botId } });
      if (!bot || bot.userId !== req.user.id) {
        return reply.status(404).send({ error: "Bot not found" });
      }

      const parsed = runListQuery.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Invalid query", details: parsed.error.flatten() });
      }

      const { page, limit, status } = parsed.data;
      const where: Prisma.BotRunWhereInput = { botId };
      if (status) where.status = status;

      const [items, total] = await Promise.all([
        prisma.botRun.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.botRun.count({ where }),
      ]);

      return {
        items: items.map(serializeRun),
        pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
      };
    }
  );

  // POST /bots/:botId/runs - start a new run
  fastify.post(
    "/bots/:botId/runs",
    { preHandler: [fastify.authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const req = request as AuthenticatedRequest;
      const { botId } = request.params as { botId: string };

      const bot = await prisma.bot.findUnique({ where: { id: botId } });
      if (!bot || bot.userId !== req.user.id) {
        return reply.status(404).send({ error: "Bot not found" });
      }

      const parsed = createRunBody.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Validation failed", details: parsed.error.flatten() });
      }

      const { exchange, marketPair, interval, durationHours } = parsed.data;

      const apiKey = await prisma.apiKey.findUnique({
        where: { userId_provider: { userId: req.user.id, provider: exchange } },
      });
      if (!apiKey) {
        return reply.status(400).send({ error: `No ${exchange} API key configured. Add one in Settings > Integrations.` });
      }

      const run = await prisma.botRun.create({
        data: {
          botId,
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
          message: `Run started on ${exchange} ${marketPair} (${interval})`,
        },
      });

      await prisma.bot.update({
        where: { id: botId },
        data: { status: "RUNNING" },
      });

      // Start the bot engine if bot has a grid config
      const gridConfig = await prisma.gridStrategyConfig.findUnique({
        where: { botId },
      });
      if (gridConfig) {
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
          botId,
          marketPair: run.marketPair,
          interval: interval as RunInterval,
          gridConfig: engineConfig,
          durationMs: 60 * 60 * 1000, // 1 hour default
        });
      }

      return reply.status(201).send(serializeRun(run));
    }
  );

  // GET /bots/:botId/runs/:runId - get single run
  fastify.get(
    "/bots/:botId/runs/:runId",
    { preHandler: [fastify.authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const req = request as AuthenticatedRequest;
      const { botId, runId } = request.params as { botId: string; runId: string };

      const bot = await prisma.bot.findUnique({ where: { id: botId } });
      if (!bot || bot.userId !== req.user.id) {
        return reply.status(404).send({ error: "Bot not found" });
      }

      const run = await prisma.botRun.findUnique({ where: { id: runId } });
      if (!run || run.botId !== botId) {
        return reply.status(404).send({ error: "Run not found" });
      }

      return serializeRun(run);
    }
  );

  // PATCH /bots/:botId/runs/:runId/status - pause/resume/stop
  fastify.patch(
    "/bots/:botId/runs/:runId/status",
    { preHandler: [fastify.authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const req = request as AuthenticatedRequest;
      const { botId, runId } = request.params as { botId: string; runId: string };

      const bot = await prisma.bot.findUnique({ where: { id: botId } });
      if (!bot || bot.userId !== req.user.id) {
        return reply.status(404).send({ error: "Bot not found" });
      }

      const existing = await prisma.botRun.findUnique({ where: { id: runId } });
      if (!existing || existing.botId !== botId) {
        return reply.status(404).send({ error: "Run not found" });
      }

      const parsed = updateRunStatusBody.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Validation failed", details: parsed.error.flatten() });
      }

      const { status } = parsed.data;

      const validTransitions: Record<string, string[]> = {
        PENDING: ["RUNNING", "STOPPED"],
        RUNNING: ["PAUSED", "STOPPED"],
        PAUSED: ["RUNNING", "STOPPED"],
      };

      if (!validTransitions[existing.status]?.includes(status)) {
        return reply.status(400).send({
          error: `Cannot transition from ${existing.status} to ${status}`,
        });
      }

      const data: Prisma.BotRunUpdateInput = { status };
      if (status === "RUNNING" && !existing.startedAt) {
        data.startedAt = new Date();
      }
      if (status === "STOPPED") {
        data.stoppedAt = new Date();
      }

      const run = await prisma.botRun.update({ where: { id: runId }, data });

      const actionMap: Record<string, string> = {
        RUNNING: existing.status === "PAUSED" ? "RUN_RESUME" : "RUN_START",
        PAUSED: "RUN_PAUSE",
        STOPPED: "RUN_STOP",
      };
      const messageMap: Record<string, string> = {
        RUNNING: existing.status === "PAUSED" ? "Run resumed" : "Run started",
        PAUSED: "Run paused",
        STOPPED: "Run stopped",
      };

      await prisma.runLog.create({
        data: {
          runId: run.id,
          action: actionMap[status] as any,
          message: messageMap[status],
        },
      });

      // Control the engine
      if (status === "PAUSED") {
        runManager.pause(runId);
      } else if (status === "RUNNING" && existing.status === "PAUSED") {
        runManager.resume(runId);
      } else if (status === "STOPPED") {
        await runManager.stop(runId);
      }

      const activeRuns = await prisma.botRun.count({
        where: { botId, status: { in: ["RUNNING", "PAUSED"] } },
      });
      if (activeRuns === 0) {
        await prisma.bot.update({
          where: { id: botId },
          data: { status: "IDLE" },
        });
      }

      return serializeRun(run);
    }
  );

  // GET /bots/:botId/runs/:runId/logs - paginated run logs
  fastify.get(
    "/bots/:botId/runs/:runId/logs",
    { preHandler: [fastify.authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const req = request as AuthenticatedRequest;
      const { botId, runId } = request.params as { botId: string; runId: string };

      const bot = await prisma.bot.findUnique({ where: { id: botId } });
      if (!bot || bot.userId !== req.user.id) {
        return reply.status(404).send({ error: "Bot not found" });
      }

      const run = await prisma.botRun.findUnique({ where: { id: runId } });
      if (!run || run.botId !== botId) {
        return reply.status(404).send({ error: "Run not found" });
      }

      const parsed = runLogListQuery.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Invalid query", details: parsed.error.flatten() });
      }

      const { page, limit } = parsed.data;
      const where = { runId };

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

  // GET /runs - list all runs for the authenticated user (cross-bot)
  fastify.get(
    "/runs",
    { preHandler: [fastify.authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const req = request as AuthenticatedRequest;
      const parsed = allRunsListQuery.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Invalid query", details: parsed.error.flatten() });
      }

      const { page, limit, status, search, strategy, exchange } = parsed.data;

      const where: Prisma.BotRunWhereInput = {
        bot: { userId: req.user.id },
      };
      if (status) where.status = status;
      if (exchange) where.exchange = exchange;
      if (strategy) where.bot = { ...where.bot as any, strategy };
      if (search) {
        where.bot = {
          ...where.bot as any,
          name: { contains: search, mode: "insensitive" },
        };
      }

      const [items, total] = await Promise.all([
        prisma.botRun.findMany({
          where,
          include: { bot: { select: { name: true, strategy: true } } },
          orderBy: { createdAt: "desc" },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.botRun.count({ where }),
      ]);

      return {
        items: items.map((run) => ({
          ...serializeRun(run),
          botName: run.bot.name,
          botStrategy: run.bot.strategy,
        })),
        pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
      };
    }
  );

  // GET /bots/:botId/runs/:runId/market - live market data from Binance
  fastify.get(
    "/bots/:botId/runs/:runId/market",
    { preHandler: [fastify.authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const req = request as AuthenticatedRequest;
      const { botId, runId } = request.params as { botId: string; runId: string };

      const bot = await prisma.bot.findUnique({ where: { id: botId } });
      if (!bot || bot.userId !== req.user.id) {
        return reply.status(404).send({ error: "Bot not found" });
      }

      const run = await prisma.botRun.findUnique({ where: { id: runId } });
      if (!run || run.botId !== botId) {
        return reply.status(404).send({ error: "Run not found" });
      }

      try {
        const symbol = toSymbol(run.marketPair);
        const [klines, ticker] = await Promise.all([
          fetchKlines(symbol, run.interval as RunInterval, 30),
          fetchTicker(symbol),
        ]);

        return {
          symbol,
          lastPrice: ticker.lastPrice,
          priceChange: ticker.priceChange,
          priceChangePercent: ticker.priceChangePercent,
          highPrice: ticker.highPrice,
          lowPrice: ticker.lowPrice,
          volume: ticker.volume,
          quoteVolume: ticker.quoteVolume,
          openPrice: ticker.openPrice,
          klines,
          fetchedAt: new Date().toISOString(),
        };
      } catch (e) {
        return reply.status(502).send({
          error: e instanceof Error ? e.message : "Failed to fetch market data",
        });
      }
    }
  );
}
