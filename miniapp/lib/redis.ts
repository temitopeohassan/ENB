// lib/redis.ts
import { Redis } from "@upstash/redis";

let redis: Redis | null = null;

function redisLog(message: string, data?: unknown) {
  const timestamp = new Date().toISOString();
  console.log(`[REDIS] ${timestamp} ${message}`);
  if (data) {
    console.log(JSON.stringify(data, null, 2));
  }
  console.log("---");
}

export function getRedis(): Redis | null {
  redisLog("🔌 Getting Redis instance");

  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.REDIS_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.REDIS_TOKEN;

  redisLog("🔍 Checking environment variables", {
    hasUpstashUrl: Boolean(process.env.UPSTASH_REDIS_REST_URL),
    hasRedisUrl: Boolean(process.env.REDIS_URL),
    hasUpstashToken: Boolean(process.env.UPSTASH_REDIS_REST_TOKEN),
    hasRedisToken: Boolean(process.env.REDIS_TOKEN),
    finalUrlSource: process.env.UPSTASH_REDIS_REST_URL ? 'UPSTASH_REDIS_REST_URL' : 
                    process.env.REDIS_URL ? 'REDIS_URL' : 'NONE',
    finalTokenSource: process.env.UPSTASH_REDIS_REST_TOKEN ? 'UPSTASH_REDIS_REST_TOKEN' : 
                      process.env.REDIS_TOKEN ? 'REDIS_TOKEN' : 'NONE',
    urlPreview: url ? `${url.substring(0, 20)}...` : 'MISSING',
    tokenPreview: token ? `${token.substring(0, 10)}...` : 'MISSING',
  });

  if (!url || !token) {
    redisLog("❌ Missing Redis credentials", {
      missingUrl: !url,
      missingToken: !token,
    });
    console.warn(
      "⚠️ Upstash REST url/token not defined (UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN or REDIS_URL/REDIS_TOKEN), Redis disabled"
    );
    return null;
  }

  // Validate URL format for Upstash REST
  try {
    redisLog("🔍 Validating URL format", { url: `${url.substring(0, 30)}...` });
    
    const parsed = new URL(url);
    
    redisLog("📊 URL analysis", {
      protocol: parsed.protocol,
      hostname: parsed.hostname,
      pathname: parsed.pathname,
      isHttp: parsed.protocol.startsWith("http"),
      isRedisCloud: parsed.hostname.includes("redns.redis-cloud.com"),
      startsWithRedis: url.startsWith("redis://"),
      startsWithRediss: url.startsWith("rediss://"),
    });

    if (!parsed.protocol.startsWith("http")) {
      redisLog("❌ Invalid protocol - not HTTP(S)", { 
        protocol: parsed.protocol,
        url: `${url.substring(0, 30)}...` 
      });
      console.error(
        "[Redis] Provided URL is not HTTP(S). Use Upstash REST URL, or switch to a Node runtime + TCP client for Redis Cloud",
        { url }
      );
      return null;
    }

    if (
      parsed.hostname.includes("redns.redis-cloud.com") ||
      url.startsWith("redis://") ||
      url.startsWith("rediss://")
    ) {
      redisLog("❌ Detected Redis Cloud endpoint", {
        hostname: parsed.hostname,
        startsWithRedis: url.startsWith("redis://") || url.startsWith("rediss://"),
      });
      console.error(
        "[Redis] Detected Redis Cloud endpoint. The @upstash/redis REST client cannot talk to Redis Cloud. Use Upstash REST (recommended) or switch to Node runtime with a TCP client (e.g., ioredis).",
        { url }
      );
      return null;
    }

    redisLog("✅ URL validation passed", {});
  } catch (e) {
    redisLog("❌ URL parsing failed", { 
      url: `${url.substring(0, 30)}...`,
      error: e instanceof Error ? e.message : e 
    });
    console.error("[Redis] Invalid URL provided for Upstash REST", { url, error: e });
    return null;
  }

  // Create Redis instance if not already created
  if (!redis) {
    const runtime = process.env.NEXT_RUNTIME || "unknown";
    const nodeEnv = process.env.NODE_ENV || "unknown";
    
    redisLog("🏗️ Creating Redis instance", {
      runtime,
      nodeEnv,
      urlPreview: `${url.substring(0, 30)}...`,
      tokenPresent: Boolean(token),
    });

    try {
      redis = new Redis({ url, token });
      redisLog("✅ Redis client initialized successfully", {
        runtime,
        nodeEnv,
      });
      console.log("[Redis] Client initialized successfully");
    } catch (e) {
      redisLog("❌ Redis client initialization failed", {
        error: e instanceof Error ? {
          name: e.name,
          message: e.message,
          stack: e.stack,
        } : e,
      });
      console.error("[Redis] Failed to initialize client", e);
      return null;
    }
  } else {
    redisLog("♻️ Using existing Redis instance", {});
  }

  // Test the connection with a simple operation
  redis.ping().then(() => {
    redisLog("✅ Redis ping successful", {});
  }).catch((pingError) => {
    redisLog("❌ Redis ping failed", { error: pingError });
  });

  return redis;
}