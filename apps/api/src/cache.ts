import { Redis } from "ioredis";

import { config } from "./config.js";

const redis = config.CACHE_ENABLED
  ? new Redis(config.REDIS_URL, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      // Do not spin forever when Redis is down.
      retryStrategy: () => null
    })
  : null;
let cacheReady = false;

if (redis) {
  // Prevent ioredis "Unhandled error event" noise when Redis is unreachable.
  redis.on("error", () => {
    cacheReady = false;
  });
}

async function ensureReady(): Promise<boolean> {
  if (!redis) {
    return false;
  }

  if (cacheReady) {
    return true;
  }

  try {
    await redis.connect();
    cacheReady = true;
    return true;
  } catch {
    return false;
  }
}

export async function getCachedJson<T>(key: string): Promise<T | null> {
  if (!(await ensureReady()) || !redis) {
    return null;
  }

  try {
    const data = await redis.get(key);
    if (!data) {
      return null;
    }
    return JSON.parse(data) as T;
  } catch {
    return null;
  }
}

export async function setCachedJson<T>(key: string, ttlSeconds: number, value: T): Promise<void> {
  if (!(await ensureReady()) || !redis) {
    return;
  }

  try {
    await redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
  } catch {
    // Cache write failures should never fail request handling.
  }
}

export async function closeCache(): Promise<void> {
  if (!redis) {
    return;
  }
  await redis.quit();
}

export function buildCacheKey(namespace: string, params: Record<string, unknown>): string {
  const normalized = Object.keys(params)
    .sort()
    .map((key) => `${key}=${String(params[key])}`)
    .join("&");
  return `f1-dashboard:${namespace}:${normalized}`;
}
