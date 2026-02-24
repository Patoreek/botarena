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

const PORT = parseInt(process.env.PORT ?? "4000", 10);
const isDev = process.env.NODE_ENV !== "production";

async function main() {
  const fastify = Fastify({ logger: true });

  await fastify.register(cors, {
    origin: isDev
      ? [
          "http://localhost:3000",
          "http://127.0.0.1:3000",
          "http://localhost:3001",
          "http://127.0.0.1:3001",
        ]
      : true,
    credentials: true,
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
  await fastify.register(wsRoutes, { prefix: "/" });

  fastify.get("/health", async () => ({ ok: true }));

  try {
    await fastify.listen({ port: PORT, host: "0.0.0.0" });
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

main();
