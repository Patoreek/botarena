import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { signupBody, loginBody, authResponse } from "@repo/shared";
import { prisma } from "../lib/db.js";
import {
  hashPassword,
  verifyPassword,
  signAccessToken,
  generateRefreshToken,
  hashRefreshToken,
  verifyRefreshTokenHash,
  getRefreshTokenExpiry,
  userToJson,
} from "../lib/auth.js";

const REFRESH_COOKIE = "refreshToken";
const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 7 * 24 * 60 * 60, // 7 days in seconds
};

function setRefreshCookie(reply: FastifyReply, token: string) {
  const domain = process.env.COOKIE_DOMAIN;
  reply.setCookie(REFRESH_COOKIE, token, {
    ...COOKIE_OPTS,
    ...(domain ? { domain } : {}),
  });
}

function clearRefreshCookie(reply: FastifyReply) {
  const domain = process.env.COOKIE_DOMAIN;
  reply.clearCookie(REFRESH_COOKIE, {
    path: "/",
    ...(domain ? { domain } : {}),
  });
}

const authRateLimit = { max: 10, timeWindow: "5 minute" };

export async function authRoutes(fastify: FastifyInstance) {
  fastify.post(
    "/auth/signup",
    { config: { rateLimit: authRateLimit } },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parsed = signupBody.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .status(400)
          .send({ error: "Validation failed", details: parsed.error.flatten() });
      }
      const email = parsed.data.email.toLowerCase();
      const { password, name } = parsed.data;

      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) {
        return reply.status(409).send({ error: "Email already registered" });
      }

      const passwordHash = await hashPassword(password);
      const user = await prisma.user.create({
        data: { email, passwordHash, name: name ?? null },
      });

      const refreshToken = generateRefreshToken();
      const tokenHash = await hashRefreshToken(refreshToken);
      await prisma.refreshToken.create({
        data: {
          tokenHash,
          userId: user.id,
          expiresAt: getRefreshTokenExpiry(),
        },
      });

      setRefreshCookie(reply, refreshToken);
      const accessToken = await signAccessToken({ sub: user.id, email: user.email });
      const response = authResponse.parse({
        user: userToJson(user),
        accessToken,
        expiresIn: 900, // 15 min in seconds
        refreshToken,
      });
      return reply.status(201).send(response);
    }
  );

  fastify.post(
    "/auth/login",
    { config: { rateLimit: authRateLimit } },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parsed = loginBody.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .status(400)
          .send({ error: "Validation failed", details: parsed.error.flatten() });
      }
      const email = parsed.data.email.toLowerCase();
      const { password } = parsed.data;

      const user = await prisma.user.findUnique({ where: { email } });
      if (!user || !(await verifyPassword(user.passwordHash, password))) {
        return reply.status(401).send({ error: "Invalid email or password" });
      }

      const refreshToken = generateRefreshToken();
      const tokenHash = await hashRefreshToken(refreshToken);
      await prisma.refreshToken.create({
        data: {
          tokenHash,
          userId: user.id,
          expiresAt: getRefreshTokenExpiry(),
        },
      });

      setRefreshCookie(reply, refreshToken);
      const accessToken = await signAccessToken({ sub: user.id, email: user.email });
      const response = authResponse.parse({
        user: userToJson(user),
        accessToken,
        expiresIn: 900,
        refreshToken,
      });
      return reply.send(response);
    }
  );

  fastify.post(
    "/auth/refresh",
    { config: { rateLimit: authRateLimit } },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const token = request.cookies[REFRESH_COOKIE];
      if (!token) {
        clearRefreshCookie(reply);
        return reply.status(401).send({ error: "No refresh token" });
      }

      const tokens = await prisma.refreshToken.findMany({
        where: { revokedAt: null, expiresAt: { gt: new Date() } },
        include: { user: true },
      });

      for (const rt of tokens) {
        const valid = await verifyRefreshTokenHash(rt.tokenHash, token);
        if (valid) {
          await prisma.refreshToken.update({
            where: { id: rt.id },
            data: { revokedAt: new Date() },
          });

          const newRefreshToken = generateRefreshToken();
          const tokenHash = await hashRefreshToken(newRefreshToken);
          await prisma.refreshToken.create({
            data: {
              tokenHash,
              userId: rt.userId,
              expiresAt: getRefreshTokenExpiry(),
            },
          });

          setRefreshCookie(reply, newRefreshToken);
          const accessToken = await signAccessToken({
            sub: rt.user.id,
            email: rt.user.email,
          });
          return reply.send({
            accessToken,
            expiresIn: 900,
            refreshToken: newRefreshToken,
          });
        }
      }

      clearRefreshCookie(reply);
      return reply.status(401).send({ error: "Invalid or expired refresh token" });
    }
  );

  fastify.post(
    "/auth/logout",
    { config: { rateLimit: authRateLimit } },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const token = request.cookies[REFRESH_COOKIE];
      if (token) {
        const tokens = await prisma.refreshToken.findMany({
          where: { revokedAt: null },
          include: { user: true },
        });
        for (const rt of tokens) {
          const valid = await verifyRefreshTokenHash(rt.tokenHash, token);
          if (valid) {
            await prisma.refreshToken.update({
              where: { id: rt.id },
              data: { revokedAt: new Date() },
            });
            break;
          }
        }
      }
      clearRefreshCookie(reply);
      return reply.send({ ok: true });
    }
  );
}
