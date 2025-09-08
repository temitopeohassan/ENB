import {
  FrameNotificationDetails,
  type SendNotificationRequest,
  sendNotificationResponseSchema,
} from "@farcaster/frame-sdk";
import { getUserNotificationDetails } from "@/lib/miniapp-notification";

const appUrl = process.env.NEXT_PUBLIC_URL || "";

type SendFrameNotificationResult =
  | { state: "error"; error: unknown }
  | { state: "no_token" }
  | { state: "rate_limit" }
  | { state: "success" };

export async function sendFrameNotification({
  fid,
  title,
  body,
  notificationDetails,
}: {
  fid?: number;
  title: string;
  body: string;
  notificationDetails?: FrameNotificationDetails | null;
}): Promise<SendFrameNotificationResult> {
  try {
    // Prefer passed-in details, otherwise look up by fid
    let details: FrameNotificationDetails | null | undefined = notificationDetails;
    if (!details && fid !== undefined) {
      details = await getUserNotificationDetails({ fid });
    }

    if (!details) {
      return { state: "no_token" };
    }

    const request: SendNotificationRequest = {
      notificationId: crypto.randomUUID(),
      title,
      body,
      targetUrl: appUrl,
      tokens: [details.token],
    };

    const response = await fetch(details.url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });

    const responseJson = await response.json().catch(() => null);

    if (response.status === 200) {
      const parsed = sendNotificationResponseSchema.safeParse(responseJson);
      if (!parsed.success) {
        return { state: "error", error: parsed.error.errors };
      }

      if (parsed.data.result.rateLimitedTokens.length > 0) {
        return { state: "rate_limit" };
      }

      return { state: "success" };
    }

    return { state: "error", error: responseJson || `HTTP ${response.status}` };
  } catch (err) {
    return { state: "error", error: err };
  }
}
