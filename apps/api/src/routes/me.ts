import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { updateProfileBody, userSchema } from "@repo/shared";
import type { AuthenticatedRequest } from "../plugins/auth.js";
import { prisma } from "../lib/db.js";
import { hashPassword, verifyPassword, userToJson } from "../lib/auth.js";

export async function meRoutes(fastify: FastifyInstance) {
  fastify.get(
    "/me",
    { preHandler: [fastify.authenticate] },
    async (request: FastifyRequest, _reply: FastifyReply) => {
      const req = request as AuthenticatedRequest;
      const user = await prisma.user.findUniqueOrThrow({
        where: { id: req.user.id },
      });
      return userSchema.parse(userToJson(user));
    }
  );

  fastify.patch(
    "/me",
    { preHandler: [fastify.authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const req = request as AuthenticatedRequest;
      const parsed = updateProfileBody.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .status(400)
          .send({ error: "Validation failed", details: parsed.error.flatten() });
      }
      const { name, email, currentPassword, newPassword } = parsed.data;

      const user = await prisma.user.findUniqueOrThrow({
        where: { id: req.user.id },
      });

      const updates: { name?: string; email?: string; passwordHash?: string } = {};
      if (name !== undefined) updates.name = name;
      if (email !== undefined) {
        const existing = await prisma.user.findUnique({ where: { email } });
        if (existing && existing.id !== user.id) {
          return reply.status(409).send({ error: "Email already in use" });
        }
        updates.email = email;
      }

      if (newPassword) {
        if (!currentPassword) {
          return reply.status(400).send({ error: "Current password required to change password" });
        }
        if (!(await verifyPassword(user.passwordHash, currentPassword))) {
          return reply.status(401).send({ error: "Current password is incorrect" });
        }
        updates.passwordHash = await hashPassword(newPassword);
      }

      const updated = await prisma.user.update({
        where: { id: user.id },
        data: updates,
      });
      return userSchema.parse(userToJson(updated));
    }
  );

  fastify.delete(
    "/me",
    { preHandler: [fastify.authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const _req = request as AuthenticatedRequest;
      // Stub: return 501 Not Implemented; can be extended to soft-delete or hard delete
      return reply.status(501).send({
        error: "Account deletion is not implemented yet",
        message: "Contact support to delete your account.",
      });
    }
  );
}
