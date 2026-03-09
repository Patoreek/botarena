import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type { AuthenticatedRequest } from "../plugins/auth.js";
import { prisma } from "../lib/db.js";
import { encrypt } from "../lib/crypto.js";
import { createApiKeyBody, updateApiKeyBody } from "@repo/shared";

function serializeApiKey(key: {
  id: string;
  provider: string;
  label: string;
  keyHint: string;
  encryptedSecret: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: key.id,
    provider: key.provider,
    label: key.label,
    keyHint: key.keyHint,
    hasSecret: key.encryptedSecret !== null,
    createdAt: key.createdAt.toISOString(),
    updatedAt: key.updatedAt.toISOString(),
  };
}

function lastN(str: string, n: number): string {
  return str.length <= n ? "****" : "****" + str.slice(-n);
}

export async function apiKeyRoutes(fastify: FastifyInstance) {
  // GET /api-keys - list all keys for the user
  fastify.get(
    "/api-keys",
    { preHandler: [fastify.authenticate] },
    async (request: FastifyRequest) => {
      const req = request as AuthenticatedRequest;
      const keys = await prisma.apiKey.findMany({
        where: { userId: req.user.id },
        orderBy: { createdAt: "desc" },
      });
      return keys.map(serializeApiKey);
    }
  );

  // POST /api-keys - create or upsert a key for a provider
  fastify.post(
    "/api-keys",
    { preHandler: [fastify.authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const req = request as AuthenticatedRequest;
      const parsed = createApiKeyBody.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Validation failed", details: parsed.error.flatten() });
      }

      const { provider, label, apiKey, apiSecret } = parsed.data;

      const encryptedKey = encrypt(apiKey);
      const encryptedSecret = apiSecret ? encrypt(apiSecret) : null;
      const keyHint = lastN(apiKey, 4);

      const key = await prisma.apiKey.upsert({
        where: { userId_provider: { userId: req.user.id, provider } },
        create: {
          userId: req.user.id,
          provider,
          label,
          encryptedKey,
          encryptedSecret,
          keyHint,
        },
        update: {
          label,
          encryptedKey,
          encryptedSecret,
          keyHint,
        },
      });

      return reply.status(201).send(serializeApiKey(key));
    }
  );

  // PATCH /api-keys/:id - update label or keys
  fastify.patch(
    "/api-keys/:id",
    { preHandler: [fastify.authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const req = request as AuthenticatedRequest;
      const { id } = request.params as { id: string };
      const parsed = updateApiKeyBody.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Validation failed", details: parsed.error.flatten() });
      }

      const existing = await prisma.apiKey.findUnique({ where: { id } });
      if (!existing || existing.userId !== req.user.id) {
        return reply.status(404).send({ error: "API key not found" });
      }

      const { label, apiKey, apiSecret } = parsed.data;

      const data: Record<string, unknown> = {};
      if (label !== undefined) data.label = label;
      if (apiKey !== undefined) {
        data.encryptedKey = encrypt(apiKey);
        data.keyHint = lastN(apiKey, 4);
      }
      if (apiSecret !== undefined) {
        data.encryptedSecret = encrypt(apiSecret);
      }

      const key = await prisma.apiKey.update({ where: { id }, data });
      return serializeApiKey(key as typeof existing);
    }
  );

  // DELETE /api-keys/:id - remove a key
  fastify.delete(
    "/api-keys/:id",
    { preHandler: [fastify.authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const req = request as AuthenticatedRequest;
      const { id } = request.params as { id: string };

      const existing = await prisma.apiKey.findUnique({ where: { id } });
      if (!existing || existing.userId !== req.user.id) {
        return reply.status(404).send({ error: "API key not found" });
      }

      await prisma.apiKey.delete({ where: { id } });
      return reply.status(204).send();
    }
  );
}
