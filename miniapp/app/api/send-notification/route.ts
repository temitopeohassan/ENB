import { NextResponse } from "next/server";
import {
  type SendNotificationRequest,
  sendNotificationResponseSchema,
} from "@farcaster/frame-sdk";
import { getUserNotificationDetails } from "@/lib/notification";
import { sendMiniAppNotification } from "@/lib/miniapp-notification";

export const runtime = "edge";
export const dynamic = "force-dynamic";

function debugLog(action: string, data?: unknown) {
  const timestamp = new Date().toISOString();
  console.log(`[SEND_NOTIFICATION] ${timestamp} ${action}`);
  if (data) console.log(JSON.stringify(data, null, 2));
  console.log("---");
}

// ✅ Add CORS headers helper
function withCors(response: NextResponse) {
  response.headers.set("Access-Control-Allow-Origin", "http://localhost:3000");
  response.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  return response;
}

// ✅ Handle preflight
export async function OPTIONS() {
  return withCors(new NextResponse(null, { status: 204 }));
}

export async function POST(request: Request) {
  let rawBody: string | null = null;
  let parsedBody: SendNotificationRequest | null = null;

  // Parse and validate JSON
  try {
    rawBody = await request.text();
    debugLog("📥 Raw request body", rawBody);

    parsedBody = JSON.parse(rawBody);
    debugLog("✅ Successfully parsed JSON body", parsedBody);
  } catch (err) {
    debugLog("❌ JSON parsing failed", { error: err });
    return withCors(
      NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 })
    );
  }

  try {
    const { fid, title, body, targetUrl, notificationId } = parsedBody as Record<
      string,
      unknown
    >;

    // ✅ Prefer fid from body
    if (fid && typeof fid === "number") {
      debugLog("✅ Using fid from request body", { fid });

      const result = await sendMiniAppNotification({
        fid,
        title: String(title),
        body: String(body),
        targetUrl: String(targetUrl),
        notificationId: notificationId ? String(notificationId) : undefined,
      });

      if (!result) {
        return withCors(
          NextResponse.json({ error: "Failed to send notification" }, { status: 500 })
        );
      }

      return withCors(
        NextResponse.json({
          success: true,
          result,
          message: "Notification sent via fid",
        })
      );
    }

    // ✅ Fallback: try to get token from request (frame-based)
    const userNotificationDetails = await getUserNotificationDetails(request);
    if (!userNotificationDetails?.token) {
      debugLog("❌ No valid fid or notification token found");
      return withCors(
        NextResponse.json(
          { error: "Must include fid in body or valid notification token" },
          { status: 400 }
        )
      );
    }

    const response = await fetch("https://api.farcaster.xyz/v2/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${userNotificationDetails.token}`,
      },
      body: JSON.stringify(parsedBody),
    });

    const result = await response.json();
    debugLog("📤 Farcaster API response", result);

    if (!response.ok) {
      return withCors(
        NextResponse.json(
          { error: "Failed to send notification", details: result },
          { status: response.status }
        )
      );
    }

    const parsedResult = sendNotificationResponseSchema.safeParse(result);
    if (!parsedResult.success) {
      debugLog("❌ Invalid response schema", parsedResult.error.format());
      return withCors(
        NextResponse.json({ error: "Invalid response schema" }, { status: 500 })
      );
    }

    return withCors(
      NextResponse.json({ success: true, result: parsedResult.data })
    );
  } catch (error) {
    debugLog("💥 Unexpected error", {
      error: error instanceof Error
        ? { name: error.name, message: error.message, stack: error.stack }
        : error,
    });

    return withCors(
      NextResponse.json({ error: "Internal server error" }, { status: 500 })
    );
  }
}
