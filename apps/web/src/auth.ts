import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import type { User } from "@repo/shared";
import { verifyOneTimeToken } from "@/lib/auth/one-time-token";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      id: "one-time-token",
      name: "Session from login/signup",
      credentials: {
        oneTimeToken: { label: "One-time token", type: "text" },
        user: { label: "User", type: "text" },
      },
      async authorize(credentials) {
        const token = credentials?.oneTimeToken;
        const userJson = credentials?.user;
        if (!token || typeof token !== "string") return null;
        const payload = await verifyOneTimeToken(token);
        if (!payload) return null;
        if (userJson && typeof userJson === "string") {
          try {
            const parsed = JSON.parse(userJson) as User;
            if (parsed.id === payload.id && parsed.email === payload.email) {
              return {
                id: parsed.id,
                email: parsed.email,
                name: parsed.name ?? undefined,
                image: undefined,
              };
            }
          } catch {
            // use payload only
          }
        }
        return {
          id: payload.id,
          email: payload.email,
          name: payload.name ?? undefined,
          image: undefined,
        };
      },
    }),
  ],
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 7 * 24 * 60 * 60, // 7 days to align with refresh cookie
  },
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.name = user.name;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.email = token.email as string;
        session.user.name = (token.name as string) ?? null;
      }
      return session;
    },
  },
});
