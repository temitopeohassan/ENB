import { Redis } from "@upstash/redis";

let redis: Redis | null = null;

export function getRedis(): Redis | null {
  if (!process.env.REDIS_URL || !process.env.REDIS_TOKEN) {
    console.warn("⚠️ REDIS_URL or REDIS_TOKEN not defined, Redis disabled");
    return null;
  }

  if (!redis) {
    redis = new Redis({
      url: process.env.REDIS_URL,
      token: process.env.REDIS_TOKEN,
    });
  }

  return redis;
}
