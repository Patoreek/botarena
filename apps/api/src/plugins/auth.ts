import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import fp from "fastify-plugin";
import { verifyAccessToken } from "../lib/auth.js";
import { prisma } from "../lib/db.js";
import { meRoutes } from "../routes/me.js";

export interface AuthenticatedRequest extends FastifyRequest {
  user: { id: string; email: string };
}

export const authPlugin = fp(async function authPlugin(fastify: FastifyInstance) {
  fastify.decorate("authenticate", async function (request: FastifyRequest, reply: FastifyReply) {
    const authHeader = request.headers.authorization;
    const token = authHeader?.startsWith("Bearer ")
      ? authHeader.slice(7)
      : (request.cookies as { accessToken?: string })?.accessToken;

    if (!token) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    const payload = await verifyAccessToken(token);
    if (!payload) {
      return reply.status(401).send({ error: "Invalid or expired token" });
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, name: true, createdAt: true, updatedAt: true },
    });
    if (!user) {
      return reply.status(401).send({ error: "User not found" });
    }

    (request as AuthenticatedRequest).user = user;
  });

  await fastify.register(meRoutes, { prefix: "/" });
});

declare module "fastify" {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}
