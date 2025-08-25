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

// Key helpers
export function getUserNotificationDetailsKey(fid: number): string {
  return `miniapp:user:${fid}`;
}

// Redis-backed storage (optional)
export async function getUserNotificationDetails(
  fid: number
): Promise<MiniAppNotificationDetails | null> {
  const redis = getRedis();
  if (!redis) {
    console.warn("⚠️ Redis not configured, notifications disabled");
    return null;
  }
  return await redis.get<MiniAppNotificationDetails>(
    getUserNotificationDetailsKey(fid)
  );
}

export async function setUserNotificationDetails(
  fid: number,
  notificationDetails: MiniAppNotificationDetails
): Promise<void> {
  const redis = getRedis();
  if (!redis) {
    console.warn("⚠️ Redis not configured, cannot save notification details");
    return;
  }
  await redis.set(getUserNotificationDetailsKey(fid), notificationDetails);
}

export async function deleteUserNotificationDetails(
  fid: number
): Promise<void> {
  const redis = getRedis();
      if (!redis) {
    console.warn("⚠️ Redis not configured, cannot delete notification details");
    return;
  }
  await redis.del(getUserNotificationDetailsKey(fid));
}

// Single notification
export async function sendMiniAppNotification({
  fid,
  title,
  body,
  targetUrl,
  notificationId,
}: {
  fid: number;
  title: string;
  body: string;
  targetUrl: string;
  notificationId?: string;
}): Promise<SendNotificationResponse | null> {
  const notificationDetails = await getUserNotificationDetails(fid);
  if (!notificationDetails) {
    console.warn(`⚠️ No notification details found for FID ${fid}`);
    return null;
  }

  const request: SendNotificationRequest = {
    notificationId: notificationId || crypto.randomUUID(),
    title,
    body,
    targetUrl,
    tokens: [notificationDetails.token],
  };

  try {
    const response = await fetch(notificationDetails.url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      console.error(`❌ Failed to send notification: ${response.status}`);
      return null;
    }

    return (await response.json()) as SendNotificationResponse;
  } catch (error) {
    console.error("❌ Error sending Mini App notification:", error);
    return null;
  }
}

// Batch notifications
export async function sendBatchMiniAppNotifications({
  notifications,
}: {
  notifications: Array<{
    fid: number;
    title: string;
    body: string;
    targetUrl: string;
    notificationId?: string;
  }>;
}): Promise<SendNotificationResponse | null> {
  if (notifications.length === 0) return null;
  if (notifications.length > 100) {
    throw new Error("Cannot send more than 100 notifications in a batch");
  }

  const groupedNotifications = new Map<
    string,
    Array<{
      fid: number;
      title: string;
      body: string;
      notificationId?: string;
      token: string;
    }>
  >();

  // Group by targetUrl
  for (const notification of notifications) {
    const details = await getUserNotificationDetails(notification.fid);
    if (!details) continue;

    if (!groupedNotifications.has(notification.targetUrl)) {
      groupedNotifications.set(notification.targetUrl, []);
    }

    groupedNotifications.get(notification.targetUrl)!.push({
      ...notification,
      token: details.token,
    });
  }

  const results: SendNotificationResponse[] = [];

  // Send each batch
for (const [targetUrl, group] of Array.from(groupedNotifications.entries())) {
  if (group.length === 0) continue;

  const tokens = group.map((n: { token: string }) => n.token);
  const first = group[0];

  const request: SendNotificationRequest = {
    notificationId: first.notificationId || crypto.randomUUID(),
    title: first.title,
    body: first.body,
    targetUrl,
    tokens,
  };

  try {
    const firstDetails = await getUserNotificationDetails(first.fid);
    if (!firstDetails?.url) {
      console.error(`❌ No URL found for FID ${first.fid}`);
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
    } else {
      console.error(`❌ Batch request failed: ${response.status}`);
    }
  } catch (err) {
    console.error("❌ Error sending batch notification:", err);
  }
}


  if (results.length === 0) return null;

  // Flatten results
  return {
    successfulTokens: results.flatMap((r) => r.successfulTokens),
    invalidTokens: results.flatMap((r) => r.invalidTokens),
    rateLimitedTokens: results.flatMap((r) => r.rateLimitedTokens),
  };
}
