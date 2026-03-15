import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type { AuthenticatedRequest } from "../plugins/auth.js";
import { prisma } from "../lib/db.js";
import {
  createBotBody,
  updateBotBody,
  updateBotStatusBody,
  botListQuery,
  botLogListQuery,
} from "@repo/shared";
import type { Prisma } from "@prisma/client";

function serializeDate(d: Date): string {
  return d.toISOString();
}

function serializeBot(bot: any) {
  return {
    id: bot.id,
    name: bot.name,
    strategy: bot.strategy,
    status: bot.status,
    archivedAt: bot.archivedAt ? serializeDate(bot.archivedAt) : null,
    createdAt: serializeDate(bot.createdAt),
    updatedAt: serializeDate(bot.updatedAt),
    stats: bot.stats
      ? {
          totalProfit: bot.stats.totalProfit,
          totalLoss: bot.stats.totalLoss,
          netPnl: bot.stats.netPnl,
          totalBuys: bot.stats.totalBuys,
          totalSells: bot.stats.totalSells,
          totalTrades: bot.stats.totalTrades,
          winCount: bot.stats.winCount,
          lossCount: bot.stats.lossCount,
          successRate: bot.stats.successRate,
          maxDrawdown: bot.stats.maxDrawdown,
          roi: bot.stats.roi,
          lastUpdatedAt: serializeDate(bot.stats.lastUpdatedAt),
        }
      : null,
    gridConfig: bot.gridConfig
      ? {
          upperPrice: bot.gridConfig.upperPrice,
          lowerPrice: bot.gridConfig.lowerPrice,
          gridCount: bot.gridConfig.gridCount,
          gridType: bot.gridConfig.gridType,
          totalInvestment: bot.gridConfig.totalInvestment,
          amountPerGrid: bot.gridConfig.amountPerGrid,
          takeProfitPrice: bot.gridConfig.takeProfitPrice,
          stopLossPrice: bot.gridConfig.stopLossPrice,
          triggerPrice: bot.gridConfig.triggerPrice,
          gridMode: bot.gridConfig.gridMode,
          orderType: bot.gridConfig.orderType,
          trailingUp: bot.gridConfig.trailingUp,
          trailingDown: bot.gridConfig.trailingDown,
          stopLossAction: bot.gridConfig.stopLossAction,
          takeProfitAction: bot.gridConfig.takeProfitAction,
          minProfitPerGrid: bot.gridConfig.minProfitPerGrid,
          maxOpenOrders: bot.gridConfig.maxOpenOrders,
        }
      : null,
  };
}

export async function botRoutes(fastify: FastifyInstance) {
  // GET /bots - paginated list
  fastify.get(
    "/bots",
    { preHandler: [fastify.authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const req = request as AuthenticatedRequest;
      const parsed = botListQuery.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Invalid query", details: parsed.error.flatten() });
      }
      const { page, limit, search, status, sortBy, sortOrder, archived } = parsed.data;

      const where: Prisma.BotWhereInput = { userId: req.user.id };
      if (archived) {
        where.archivedAt = { not: null };
      } else {
        where.archivedAt = null;
      }
      if (search) {
        where.name = { contains: search, mode: "insensitive" };
      }
      if (status) {
        where.status = status;
      }

      const [items, total] = await Promise.all([
        prisma.bot.findMany({
          where,
          include: { stats: true },
          orderBy: { [sortBy]: sortOrder },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.bot.count({ where }),
      ]);

      return {
        items: items.map((bot) => serializeBot(bot)),
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      };
    }
  );

  // POST /bots - create
  fastify.post(
    "/bots",
    { preHandler: [fastify.authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const req = request as AuthenticatedRequest;
      const parsed = createBotBody.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Validation failed", details: parsed.error.flatten() });
      }
      const { name, strategy, gridConfig } = parsed.data;

      const bot = await prisma.bot.create({
        data: {
          userId: req.user.id,
          name,
          strategy,
          stats: { create: {} },
          gridConfig: {
            create: {
              upperPrice: gridConfig.upperPrice,
              lowerPrice: gridConfig.lowerPrice,
              gridCount: gridConfig.gridCount,
              gridType: gridConfig.gridType,
              totalInvestment: gridConfig.totalInvestment,
              amountPerGrid: gridConfig.amountPerGrid,
              takeProfitPrice: gridConfig.takeProfitPrice ?? null,
              stopLossPrice: gridConfig.stopLossPrice ?? null,
              triggerPrice: gridConfig.triggerPrice ?? null,
              gridMode: gridConfig.gridMode,
              orderType: gridConfig.orderType,
              trailingUp: gridConfig.trailingUp,
              trailingDown: gridConfig.trailingDown,
              stopLossAction: gridConfig.stopLossAction,
              takeProfitAction: gridConfig.takeProfitAction,
              minProfitPerGrid: gridConfig.minProfitPerGrid ?? null,
              maxOpenOrders: gridConfig.maxOpenOrders ?? null,
            },
          },
          logs: {
            create: {
              action: "CONFIG_CHANGE",
              message: `Bot "${name}" created with ${strategy} strategy`,
            },
          },
        },
        include: { stats: true, gridConfig: true },
      });

      return reply.status(201).send(serializeBot(bot));
    }
  );

  // GET /bots/:id - single bot detail
  fastify.get(
    "/bots/:id",
    { preHandler: [fastify.authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const req = request as AuthenticatedRequest;
      const { id } = request.params as { id: string };
      const bot = await prisma.bot.findUnique({
        where: { id },
        include: { stats: true, gridConfig: true },
      });

      if (!bot || bot.userId !== req.user.id) {
        return reply.status(404).send({ error: "Bot not found" });
      }

      return serializeBot(bot);
    }
  );

  // PATCH /bots/:id - update bot
  fastify.patch(
    "/bots/:id",
    { preHandler: [fastify.authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const req = request as AuthenticatedRequest;
      const { id } = request.params as { id: string };
      const parsed = updateBotBody.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Validation failed", details: parsed.error.flatten() });
      }

      const existing = await prisma.bot.findUnique({
        where: { id },
        include: { gridConfig: true },
      });
      if (!existing || existing.userId !== req.user.id) {
        return reply.status(404).send({ error: "Bot not found" });
      }

      const { name, gridConfig } = parsed.data;

      const botData: Prisma.BotUpdateInput = {};
      if (name !== undefined) botData.name = name;

      if (gridConfig && existing.gridConfig) {
        botData.gridConfig = {
          update: {
            ...(gridConfig.upperPrice !== undefined && { upperPrice: gridConfig.upperPrice }),
            ...(gridConfig.lowerPrice !== undefined && { lowerPrice: gridConfig.lowerPrice }),
            ...(gridConfig.gridCount !== undefined && { gridCount: gridConfig.gridCount }),
            ...(gridConfig.gridType !== undefined && { gridType: gridConfig.gridType }),
            ...(gridConfig.totalInvestment !== undefined && { totalInvestment: gridConfig.totalInvestment }),
            ...(gridConfig.amountPerGrid !== undefined && { amountPerGrid: gridConfig.amountPerGrid }),
            ...(gridConfig.takeProfitPrice !== undefined && { takeProfitPrice: gridConfig.takeProfitPrice }),
            ...(gridConfig.stopLossPrice !== undefined && { stopLossPrice: gridConfig.stopLossPrice }),
            ...(gridConfig.triggerPrice !== undefined && { triggerPrice: gridConfig.triggerPrice }),
            ...(gridConfig.gridMode !== undefined && { gridMode: gridConfig.gridMode }),
            ...(gridConfig.orderType !== undefined && { orderType: gridConfig.orderType }),
            ...(gridConfig.trailingUp !== undefined && { trailingUp: gridConfig.trailingUp }),
            ...(gridConfig.trailingDown !== undefined && { trailingDown: gridConfig.trailingDown }),
            ...(gridConfig.stopLossAction !== undefined && { stopLossAction: gridConfig.stopLossAction }),
            ...(gridConfig.takeProfitAction !== undefined && { takeProfitAction: gridConfig.takeProfitAction }),
            ...(gridConfig.minProfitPerGrid !== undefined && { minProfitPerGrid: gridConfig.minProfitPerGrid }),
            ...(gridConfig.maxOpenOrders !== undefined && { maxOpenOrders: gridConfig.maxOpenOrders }),
          },
        };
      }

      const bot = await prisma.bot.update({
        where: { id },
        data: botData,
        include: { stats: true, gridConfig: true },
      });

      await prisma.botLog.create({
        data: {
          botId: bot.id,
          action: "CONFIG_CHANGE",
          message: "Bot configuration updated",
        },
      });

      return serializeBot(bot);
    }
  );

  // PATCH /bots/:id/status - start/stop bot
  fastify.patch(
    "/bots/:id/status",
    { preHandler: [fastify.authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const req = request as AuthenticatedRequest;
      const { id } = request.params as { id: string };
      const parsed = updateBotStatusBody.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Validation failed", details: parsed.error.flatten() });
      }

      const existing = await prisma.bot.findUnique({ where: { id } });
      if (!existing || existing.userId !== req.user.id) {
        return reply.status(404).send({ error: "Bot not found" });
      }

      const { status } = parsed.data;
      const bot = await prisma.bot.update({
        where: { id },
        data: { status },
        include: { stats: true, gridConfig: true },
      });

      await prisma.botLog.create({
        data: {
          botId: bot.id,
          action: status === "RUNNING" ? "BOT_START" : "BOT_STOP",
          message: status === "RUNNING" ? "Bot started" : "Bot stopped",
        },
      });

      return serializeBot(bot);
    }
  );

  // PATCH /bots/:id/archive - archive bot
  fastify.patch(
    "/bots/:id/archive",
    { preHandler: [fastify.authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const req = request as AuthenticatedRequest;
      const { id } = request.params as { id: string };
      const existing = await prisma.bot.findUnique({ where: { id } });
      if (!existing || existing.userId !== req.user.id) {
        return reply.status(404).send({ error: "Bot not found" });
      }
      if (existing.archivedAt) {
        return reply.status(400).send({ error: "Bot is already archived" });
      }

      const bot = await prisma.bot.update({
        where: { id },
        data: { archivedAt: new Date(), status: "STOPPED" },
        include: { stats: true, gridConfig: true },
      });

      await prisma.botLog.create({
        data: {
          botId: bot.id,
          action: "MANUAL",
          message: "Bot archived",
        },
      });

      return serializeBot(bot);
    }
  );

  // PATCH /bots/:id/restore - restore archived bot
  fastify.patch(
    "/bots/:id/restore",
    { preHandler: [fastify.authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const req = request as AuthenticatedRequest;
      const { id } = request.params as { id: string };
      const existing = await prisma.bot.findUnique({ where: { id } });
      if (!existing || existing.userId !== req.user.id) {
        return reply.status(404).send({ error: "Bot not found" });
      }
      if (!existing.archivedAt) {
        return reply.status(400).send({ error: "Bot is not archived" });
      }

      const bot = await prisma.bot.update({
        where: { id },
        data: { archivedAt: null, status: "IDLE" },
        include: { stats: true, gridConfig: true },
      });

      await prisma.botLog.create({
        data: {
          botId: bot.id,
          action: "MANUAL",
          message: "Bot restored from archive",
        },
      });

      return serializeBot(bot);
    }
  );

  // DELETE /bots/:id - delete bot (cascades)
  fastify.delete(
    "/bots/:id",
    { preHandler: [fastify.authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const req = request as AuthenticatedRequest;
      const { id } = request.params as { id: string };
      const existing = await prisma.bot.findUnique({ where: { id } });
      if (!existing || existing.userId !== req.user.id) {
        return reply.status(404).send({ error: "Bot not found" });
      }

      await prisma.bot.delete({ where: { id } });
      return reply.status(204).send();
    }
  );

  // GET /bots/:id/logs - paginated logs
  fastify.get(
    "/bots/:id/logs",
    { preHandler: [fastify.authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const req = request as AuthenticatedRequest;
      const { id } = request.params as { id: string };
      const parsed = botLogListQuery.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Invalid query", details: parsed.error.flatten() });
      }

      const existing = await prisma.bot.findUnique({ where: { id } });
      if (!existing || existing.userId !== req.user.id) {
        return reply.status(404).send({ error: "Bot not found" });
      }

      const { page, limit } = parsed.data;
      const where = { botId: id };

      const [items, total] = await Promise.all([
        prisma.botLog.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.botLog.count({ where }),
      ]);

      return {
        items: items.map((log) => ({
          id: log.id,
          action: log.action,
          message: log.message,
          metadata: log.metadata,
          createdAt: serializeDate(log.createdAt),
        })),
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      };
    }
  );
}
