// lib/miniapp-notifications.ts
import { getRedis } from "./redis";

// Interfaces
export interface MiniAppNotificationDetails {
  token: string;
  url: string;
}

export interface SendNotificationRequest {
  notificationId: string;
  title: string;
  body: string;
  targetUrl: string;
  tokens: string[];
}

export interface SendNotificationResponse {
  successfulTokens: string[];
  invalidTokens: string[];
  rateLimitedTokens: string[];
}

function debugLog(action: string, data: unknown) {
  const timestamp = new Date().toISOString();
  console.log(`[NOTIFICATIONS] ${timestamp} ${action}`);
  console.log(JSON.stringify(data, null, 2));
  console.log("---");
}

// Key helpers
function getUserNotificationDetailsKey(identifier: {
  fid?: number;
  token?: string;
  url?: string;
}): string {
  debugLog("🔑 Generating Redis key", { identifier });
  
  if (identifier.fid !== undefined) {
    const key = `miniapp:user:${identifier.fid}`;
    debugLog("✅ Generated fid-based key", { key, fid: identifier.fid });
    return key;
  }
  
  if (identifier.token && identifier.url) {
    const key = `miniapp:token:${identifier.token}:url:${identifier.url}`;
    debugLog("✅ Generated token+url-based key", { 
      key, 
      tokenPreview: `${identifier.token.substring(0, 10)}...`,
      url: identifier.url 
    });
    return key;
  }
  
  debugLog("❌ Invalid identifier for key generation", { identifier });
  throw new Error("Invalid identifier: must include fid or token+url");
}

// Redis-backed storage
export async function getUserNotificationDetails(identifier: {
  fid?: number;
  token?: string;
  url?: string;
}): Promise<MiniAppNotificationDetails | null> {
  debugLog("📖 GET: Starting retrieval", { identifier });
  
  const redis = getRedis();
  if (!redis) {
    debugLog("⚠️ GET: Redis not configured", {});
    console.warn("⚠️ Redis not configured, notifications disabled");
    return null;
  }
  
  let key: string;
  try {
    key = getUserNotificationDetailsKey(identifier);
  } catch (keyError) {
    debugLog("❌ GET: Key generation failed", { error: keyError });
    throw keyError;
  }
  
  try {
    debugLog("🔍 GET: Querying Redis", { key });
    const value = await redis.get<MiniAppNotificationDetails>(key);
    
    debugLog("✅ GET: Redis query completed", { 
      key, 
      found: Boolean(value),
      hasToken: value ? Boolean(value.token) : false,
      hasUrl: value ? Boolean(value.url) : false,
    });
    
    return value;
  } catch (e) {
    debugLog("❌ GET: Redis query failed", { key, error: e });
    console.error("[Notifications] Redis GET error", { key, error: e });
    throw e;
  }
}

export async function setUserNotificationDetails(
  identifier: { fid?: number; token?: string; url?: string },
  notificationDetails: MiniAppNotificationDetails
): Promise<void> {
  debugLog("💾 SET: Starting storage", { 
    identifier, 
    notificationDetails: {
      hasToken: Boolean(notificationDetails.token),
      hasUrl: Boolean(notificationDetails.url),
      tokenPreview: notificationDetails.token ? `${notificationDetails.token.substring(0, 10)}...` : undefined,
      url: notificationDetails.url,
    }
  });
  
  const redis = getRedis();
  if (!redis) {
    debugLog("⚠️ SET: Redis not configured", {});
    console.warn("⚠️ Redis not configured, cannot save notification details");
    return;
  }
  
  // Validate notification details
  if (!notificationDetails.token || !notificationDetails.url) {
    debugLog("❌ SET: Invalid notification details", { 
      hasToken: Boolean(notificationDetails.token),
      hasUrl: Boolean(notificationDetails.url),
      notificationDetails 
    });
    throw new Error("notificationDetails must include both token and url");
  }
  
  let key: string;
  try {
    key = getUserNotificationDetailsKey(identifier);
  } catch (keyError) {
    debugLog("❌ SET: Key generation failed", { error: keyError });
    throw keyError;
  }
  
  try {
    debugLog("💾 SET: Storing in Redis", { key });
    await redis.set(key, notificationDetails);
    debugLog("✅ SET: Successfully stored", { key });
    console.log("[Notifications] Redis SET", { key });
  } catch (e) {
    debugLog("❌ SET: Redis storage failed", { key, error: e });
    console.error("[Notifications] Redis SET error", { key, error: e });
    throw e;
  }
}

export async function deleteUserNotificationDetails(identifier: {
  fid?: number;
  token?: string;
  url?: string;
}): Promise<void> {
  debugLog("🗑️ DELETE: Starting deletion", { identifier });
  
  const redis = getRedis();
  if (!redis) {
    debugLog("⚠️ DELETE: Redis not configured", {});
    console.warn("⚠️ Redis not configured, cannot delete notification details");
    return;
  }
  
  let key: string;
  try {
    key = getUserNotificationDetailsKey(identifier);
  } catch (keyError) {
    debugLog("❌ DELETE: Key generation failed", { error: keyError });
    throw keyError;
  }
  
  try {
    debugLog("🗑️ DELETE: Deleting from Redis", { key });
    const result = await redis.del(key);
    debugLog("✅ DELETE: Completed", { key, deletedCount: result });
    console.log("[Notifications] Redis DEL", { key, deletedCount: result });
  } catch (e) {
    debugLog("❌ DELETE: Redis deletion failed", { key, error: e });
    console.error("[Notifications] Redis DEL error", { key, error: e });
    throw e;
  }
}

// Single notification
export async function sendMiniAppNotification({
  fid,
  token,
  url,
  title,
  body,
  targetUrl,
  notificationId,
}: {
  fid?: number;
  token?: string;
  url?: string;
  title: string;
  body: string;
  targetUrl: string;
  notificationId?: string;
}): Promise<SendNotificationResponse | null> {
  debugLog("📤 SEND: Starting single notification", {
    identifier: { fid, token: token ? `${token.substring(0, 10)}...` : undefined, url },
    title,
    body,
    targetUrl,
    notificationId,
  });

  const notificationDetails = await getUserNotificationDetails({ fid, token, url });
  if (!notificationDetails) {
    debugLog("❌ SEND: No notification details found", { fid, token, url });
    console.warn(`⚠️ No notification details found for`, { fid, token, url });
    return null;
  }

  debugLog("📋 SEND: Found notification details", {
    tokenPreview: `${notificationDetails.token.substring(0, 10)}...`,
    url: notificationDetails.url,
  });

  const request: SendNotificationRequest = {
    notificationId: notificationId || crypto.randomUUID(),
    title,
    body,
    targetUrl,
    tokens: [notificationDetails.token],
  };

  debugLog("🚀 SEND: Making notification request", {
    url: notificationDetails.url,
    requestPayload: {
      ...request,
      tokens: request.tokens.map(t => `${t.substring(0, 10)}...`),
    },
  });

  try {
    const response = await fetch(notificationDetails.url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });

    debugLog("📨 SEND: Received response", {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      debugLog("❌ SEND: Request failed", {
        status: response.status,
        statusText: response.statusText,
        errorBody: errorText,
      });
      console.error(`❌ Failed to send notification: ${response.status} ${response.statusText}`, errorText);
      return null;
    }

    const result = (await response.json()) as SendNotificationResponse;
    debugLog("✅ SEND: Successfully sent notification", {
      successCount: result.successfulTokens?.length || 0,
      invalidCount: result.invalidTokens?.length || 0,
      rateLimitedCount: result.rateLimitedTokens?.length || 0,
    });

    return result;
  } catch (error) {
    debugLog("💥 SEND: Network/parsing error", { error });
    console.error("❌ Error sending Mini App notification:", error);
    return null;
  }
}

// Batch notifications - keeping existing implementation but with better logging
export async function sendBatchMiniAppNotifications({
  notifications,
}: {
  notifications: Array<{
    fid?: number;
    token?: string;
    url?: string;
    title: string;
    body: string;
    targetUrl: string;
    notificationId?: string;
  }>;
}): Promise<SendNotificationResponse | null> {
  debugLog("📦 BATCH: Starting batch notifications", {
    count: notifications.length,
  });

  if (notifications.length === 0) {
    debugLog("⚠️ BATCH: No notifications to send", {});
    return null;
  }
  
  if (notifications.length > 100) {
    debugLog("❌ BATCH: Too many notifications", { count: notifications.length });
    throw new Error("Cannot send more than 100 notifications in a batch");
  }

  const groupedNotifications = new Map<
    string,
    Array<{
      fid?: number;
      token?: string;
      url?: string;
      title: string;
      body: string;
      notificationId?: string;
      tokenValue: string;
    }>
  >();

  debugLog("🔄 BATCH: Grouping notifications by targetUrl", {});

  // Group by targetUrl
  for (const notification of notifications) {
    const details = await getUserNotificationDetails({
      fid: notification.fid,
      token: notification.token,
      url: notification.url,
    });
    if (!details) continue;

    if (!groupedNotifications.has(notification.targetUrl)) {
      groupedNotifications.set(notification.targetUrl, []);
    }

    groupedNotifications.get(notification.targetUrl)!.push({
      ...notification,
      tokenValue: details.token,
    });
  }

  debugLog("📊 BATCH: Grouped notifications", {
    groups: Array.from(groupedNotifications.entries()).map(([targetUrl, items]) => ({
      targetUrl,
      count: items.length,
    })),
  });

  const results: SendNotificationResponse[] = [];

  // Send each batch
  for (const [targetUrl, group] of Array.from(groupedNotifications.entries())) {
    if (group.length === 0) continue;

    debugLog("🚀 BATCH: Sending group", { targetUrl, count: group.length });

    const tokens = group.map((n) => n.tokenValue);
    const first = group[0];

    const request: SendNotificationRequest = {
      notificationId: first.notificationId || crypto.randomUUID(),
      title: first.title,
      body: first.body,
      targetUrl,
      tokens,
    };

    try {
      const firstDetails = await getUserNotificationDetails({
        fid: first.fid,
        token: first.token,
        url: first.url,
      });
      if (!firstDetails?.url) {
        debugLog("❌ BATCH: No URL found for first item", { first });
        console.error(`❌ No URL found for`, first);
        continue;
      }

      const response = await fetch(firstDetails.url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      });

      if (response.ok) {
        const data = (await response.json()) as SendNotificationResponse;
        results.push(data);
        debugLog("✅ BATCH: Group sent successfully", {
          targetUrl,
          successCount: data.successfulTokens?.length || 0,
        });
      } else {
        const errorText = await response.text().catch(() => 'Unknown error');
        debugLog("❌ BATCH: Group request failed", {
          targetUrl,
          status: response.status,
          statusText: response.statusText,
          errorBody: errorText,
        });
        console.error(`❌ Batch request failed: ${response.status}`, errorText);
      }
    } catch (err) {
      debugLog("💥 BATCH: Group error", { targetUrl, error: err });
      console.error("❌ Error sending batch notification:", err);
    }
  }

  if (results.length === 0) {
    debugLog("❌ BATCH: No successful results", {});
    return null;
  }

  // Flatten results
  const finalResult = {
    successfulTokens: results.flatMap((r) => r.successfulTokens),
    invalidTokens: results.flatMap((r) => r.invalidTokens),
    rateLimitedTokens: results.flatMap((r) => r.rateLimitedTokens),
  };

  debugLog("✅ BATCH: All batches completed", {
    totalSuccess: finalResult.successfulTokens.length,
    totalInvalid: finalResult.invalidTokens.length,
    totalRateLimited: finalResult.rateLimitedTokens.length,
  });

  return finalResult;
}