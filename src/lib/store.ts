import { Redis } from "@upstash/redis";

/**
 * One Upstash database serves dev, preview and production; only the key prefix
 * separates them, so a laptop with a bare shell can never write production keys
 * by accident.
 */

let client: Redis | undefined;

/**
 * Lazy on purpose: `next build` evaluates module scope before the Marketplace
 * env vars exist on a first deploy, and `Redis.fromEnv()` throws without them.
 *
 * `fromEnv()` reads `UPSTASH_REDIS_REST_URL || KV_REST_API_URL` and the matching
 * token, so whichever pair the integration injects works and no name is
 * hard-coded here.
 */
export function getRedis(): Redis {
  client ??= Redis.fromEnv();
  return client;
}

/** Pure, so both branches are testable without touching `process.env`. */
export function prefixFor(env: string | undefined): string {
  return env === "production" ? "tp:prod:" : "tp:dev:";
}

/**
 * Every key goes through here. Read at call time rather than at module scope so
 * a script that sets `VERCEL_ENV` from a flag is obeyed however it imports this.
 */
export function k(name: string): string {
  return prefixFor(process.env.VERCEL_ENV) + name;
}
