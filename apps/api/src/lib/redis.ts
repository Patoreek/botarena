import Redis from "ioredis";

const url = process.env.REDIS_URL ?? "redis://localhost:6379";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const redis = new (Redis as any)(url, { maxRetriesPerRequest: 3 });

redis.on("error", (err: Error) => {
  console.error("[Redis]", err.message);
});
