# Botarena

Production-ready Turborepo monorepo with Next.js 15, Fastify API, PostgreSQL, Redis, and shared Zod schemas.

## Prerequisites

- **Node.js** 20+
- **pnpm** 9+ (`npm install -g pnpm`)
- **Docker** (for Postgres and Redis)

## Quick start (macOS)

### 1. Install dependencies

```bash
cd botarena
pnpm install
```

### 2. Environment variables

Copy the root example env and fill in values:

```bash
cp .env.example .env
```

Edit `.env` and set at least:

- `DATABASE_URL` — e.g. `postgresql://postgres:postgres@localhost:5432/botarena`
- `REDIS_URL` — e.g. `redis://localhost:6379`
- `JWT_SECRET` — a long random string for production

For the web app, copy the web example and set the API/WS URLs:

```bash
cp apps/web/.env.local.example apps/web/.env.local
```

In `apps/web/.env.local`:

- `NEXT_PUBLIC_API_URL` — e.g. `http://localhost:4000`
- `NEXT_PUBLIC_WS_URL` — e.g. `ws://localhost:4000/ws`

### 3. Start Postgres and Redis

```bash
docker compose up -d
```

### 4. Run database migrations

```bash
pnpm db:migrate
```

Or for first-time schema sync (no migration history):

```bash
pnpm db:push
```

### 5. Start dev servers

```bash
pnpm dev
```

- **Web:** http://localhost:3000  
- **API:** http://localhost:4000  

### 6. (Optional) Prisma Studio

```bash
pnpm db:studio
```

## Project structure

```
apps/
  web/          # Next.js 15 App Router, Tailwind, shadcn/ui, next-themes
  api/          # Fastify API, Prisma, Redis, JWT + cookie auth, WebSocket
packages/
  shared/       # Zod schemas and shared TypeScript types
  config/       # Shared ESLint and tsconfig
```

## Scripts

| Command           | Description                          |
|------------------|--------------------------------------|
| `pnpm dev`       | Run web + API in development         |
| `pnpm build`     | Build all apps and packages           |
| `pnpm lint`      | Lint all workspaces                   |
| `pnpm format`    | Format with Prettier                  |
| `pnpm db:push`   | Push Prisma schema (no migrations)    |
| `pnpm db:migrate`| Apply Prisma migrations              |
| `pnpm db:studio` | Open Prisma Studio                    |

## Environment variables

### API (`apps/api`)

| Variable              | Description                    | Example                          |
|-----------------------|--------------------------------|----------------------------------|
| `DATABASE_URL`        | PostgreSQL connection string   | `postgresql://...@localhost:5432/botarena` |
| `REDIS_URL`           | Redis connection string       | `redis://localhost:6379`         |
| `JWT_SECRET`          | Secret for JWT signing        | Long random string               |
| `JWT_ACCESS_EXPIRES_IN`| Access token TTL              | `15m`                            |
| `JWT_REFRESH_EXPIRES_IN`| Refresh token TTL           | `7d`                             |
| `PORT`                | API port                      | `4000`                           |
| `NODE_ENV`            | `development` / `production`  | `development`                    |
| `COOKIE_DOMAIN`       | Optional cookie domain        | `localhost`                      |

### Web (`apps/web/.env.local`)

| Variable                 | Description              | Example                     |
|--------------------------|--------------------------|-----------------------------|
| `NEXT_PUBLIC_API_URL`    | API base URL             | `http://localhost:4000`     |
| `NEXT_PUBLIC_WS_URL`     | WebSocket URL            | `ws://localhost:4000/ws`    |

## Auth

- **Signup / Login:** Email + password, validated with Zod; password hashed with argon2.
- **Sessions:** Short-lived JWT access token (e.g. 15 min) in memory; refresh token in httpOnly cookie; refresh tokens stored in DB and rotated on use.
- **Protected routes:** Dashboard and settings require auth; unauthenticated users are redirected to `/login`.

For cross-origin setups (e.g. API on a different host/port), the refresh cookie must use `sameSite: 'none'` and `secure: true` so the browser sends it with cross-origin requests; that requires HTTPS. For local dev on HTTP, use the same origin for API and web (e.g. a reverse proxy) or accept that refresh will fail after a full page reload unless you use HTTPS.

## WebSocket

- **Endpoint:** `GET /ws`
- **Auth:** Pass access token as query param `token` (or via cookie if configured).
- **Events:** After connect you receive `server:hello` and then `server:time` every 5 seconds.

The dashboard shows connection status and the last event received.

## Optional

- **Rate limit:** Auth routes use a stricter limit (e.g. 10 req / 5 min per IP); adjust in `apps/api/src/routes/auth.ts`.
- **JWT expiry:** Tune `JWT_ACCESS_EXPIRES_IN` and `JWT_REFRESH_EXPIRES_IN` in `.env`.
- **Account deletion:** `DELETE /me` is stubbed (501); extend in `apps/api/src/routes/me.ts` if needed.
