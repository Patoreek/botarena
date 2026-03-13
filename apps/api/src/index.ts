import Fastify from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import rateLimit from "@fastify/rate-limit";
import websocket from "@fastify/websocket";
import { redis } from "./lib/redis.js";
import { authPlugin } from "./plugins/auth.js";
import { authRoutes } from "./routes/auth.js";
import { meRoutes } from "./routes/me.js";
import { wsRoutes } from "./routes/ws.js";
import { botRoutes } from "./routes/bots.js";
import { apiKeyRoutes } from "./routes/api-keys.js";
import { runRoutes } from "./routes/runs.js";
import { prisma } from "./lib/db.js";

const PORT = parseInt(process.env.PORT ?? "4000", 10);
const isDev = process.env.NODE_ENV !== "production";

/**
 * On startup, mark any orphaned RUNNING/PAUSED runs as STOPPED.
 * This handles cases where the server restarted while bots were running.
 */
async function cleanupOrphanedRuns() {
  try {
    const orphaned = await prisma.botRun.findMany({
      where: { status: { in: ["RUNNING", "PAUSED"] } },
      select: { id: true, botId: true },
    });

    if (orphaned.length === 0) return;

    console.log(`[startup] Found ${orphaned.length} orphaned run(s), marking as STOPPED...`);

    await prisma.botRun.updateMany({
      where: { status: { in: ["RUNNING", "PAUSED"] } },
      data: { status: "STOPPED", stoppedAt: new Date() },
    });

    // Log each orphaned run
    await prisma.runLog.createMany({
      data: orphaned.map((run) => ({
        runId: run.id,
        action: "RUN_STOP" as const,
        message: "Run stopped: server restarted while run was active",
      })),
    });

    // Reset any bots that were RUNNING back to IDLE
    const botIds = [...new Set(orphaned.map((r) => r.botId))];
    await prisma.bot.updateMany({
      where: { id: { in: botIds }, status: "RUNNING" },
      data: { status: "IDLE" },
    });

    console.log(`[startup] Cleaned up ${orphaned.length} orphaned run(s) and ${botIds.length} bot(s)`);
  } catch (err) {
    console.error("[startup] Failed to clean up orphaned runs:", err);
  }
}

async function main() {
  const fastify = Fastify({ logger: true });

  await fastify.register(cors, {
    origin: isDev
      ? [
          "http://localhost:3000",
          "http://127.0.0.1:3000",
          "http://localhost:3001",
          "http://127.0.0.1:3001",
          "http://localhost:5000",
          "http://127.0.0.1:5000",
          "http://localhost:5001",
          "http://127.0.0.1:5001",
        ]
      : true,
    credentials: true,
    methods: ["GET", "HEAD", "PUT", "POST", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  });

  await fastify.register(cookie, {
    secret: process.env.JWT_SECRET ?? "cookie-secret",
  });

  await fastify.register(websocket);

  await fastify.register(rateLimit, {
    max: 100,
    timeWindow: "1 minute",
    redis,
  });

  await fastify.register(authPlugin);

  fastify.register(authRoutes, { prefix: "/" });
  fastify.register(botRoutes, { prefix: "/" });
  fastify.register(apiKeyRoutes, { prefix: "/" });
  fastify.register(runRoutes, { prefix: "/" });
  await fastify.register(wsRoutes, { prefix: "/" });

  fastify.get("/health", async () => ({ ok: true }));

  // Clean up orphaned runs from previous server instance
  await cleanupOrphanedRuns();

  try {
    await fastify.listen({ port: PORT, host: "0.0.0.0" });
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

main();
