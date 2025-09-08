import { NextRequest, NextResponse } from "next/server";
import { sendMiniAppNotification } from "@/lib/miniapp-notification";

export const runtime = "edge"; // or "nodejs" if needed
export const dynamic = "force-dynamic";

function debugLog(action: string, data: unknown) {
  const timestamp = new Date().toISOString();
  console.log(`[SEND_NOTIFICATION] ${timestamp} ${action}`);
  console.log(JSON.stringify(data, null, 2));
  console.log("---");
}

function isValidUrl(string: string): boolean {
  try {
    new URL(string);
    return true;
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  debugLog("🚀 POST request received", {
    method: request.method,
    url: request.url,
    headers: Object.fromEntries(request.headers.entries()),
  });

  try {
    // Parse and log request body
    let rawBody: string;
    let parsedBody: unknown;
    
    try {
      rawBody = await request.text();
      debugLog("📥 Raw request body", rawBody);
      
      parsedBody = JSON.parse(rawBody);
      debugLog("✅ Successfully parsed JSON body", parsedBody);
    } catch (parseError) {
      debugLog("❌ JSON parsing failed", {
        error: parseError,
      });
      return NextResponse.json(
        { error: "Invalid JSON in request body" },
        { status: 400 }
      );
    }

    // Validate body structure
    if (!parsedBody || typeof parsedBody !== 'object' || Array.isArray(parsedBody)) {
      debugLog("❌ Body is not a valid object", { 
        parsedBody, 
        type: typeof parsedBody,
        isArray: Array.isArray(parsedBody)
      });
      return NextResponse.json(
        { error: "Request body must be a JSON object" },
        { status: 400 }
      );
    }

    // Type assertion after validation
    const bodyObj = parsedBody as Record<string, unknown>;
    const { fid, title, body: messageBody, targetUrl, notificationId } = bodyObj;

    debugLog("📊 Extracted fields", {
      fid,
      title,
      messageBody,
      targetUrl,
      notificationId,
      hasAllRequired: Boolean(fid && title && messageBody && targetUrl),
    });

    // Validate required fields
    const missingFields: string[] = [];
    if (!fid) missingFields.push("fid");
    if (!title) missingFields.push("title");
    if (!messageBody) missingFields.push("body");
    if (!targetUrl) missingFields.push("targetUrl");

    if (missingFields.length > 0) {
      debugLog("❌ Missing required fields", { missingFields });
      return NextResponse.json(
        { 
          error: `Missing required fields: ${missingFields.join(", ")}`,
          received: { fid, title, body: messageBody, targetUrl, notificationId }
        },
        { status: 400 }
      );
    }

    // Validate field types
    if (typeof fid !== "number" || fid <= 0) {
      debugLog("❌ Invalid fid", { fid, type: typeof fid });
      return NextResponse.json(
        { error: "fid must be a positive number" },
        { status: 400 }
      );
    }

    if (typeof title !== "string" || title.trim().length === 0) {
      debugLog("❌ Invalid title", { title, type: typeof title });
      return NextResponse.json(
        { error: "title must be a non-empty string" },
        { status: 400 }
      );
    }

    if (typeof messageBody !== "string" || messageBody.trim().length === 0) {
      debugLog("❌ Invalid body", { messageBody, type: typeof messageBody });
      return NextResponse.json(
        { error: "body must be a non-empty string" },
        { status: 400 }
      );
    }

    if (typeof targetUrl !== "string" || !isValidUrl(targetUrl)) {
      debugLog("❌ Invalid targetUrl", { targetUrl, type: typeof targetUrl });
      return NextResponse.json(
        { error: "targetUrl must be a valid URL" },
        { status: 400 }
      );
    }

    // Validate optional notificationId
    if (notificationId !== undefined && typeof notificationId !== "string") {
      debugLog("❌ Invalid notificationId", { notificationId, type: typeof notificationId });
      return NextResponse.json(
        { error: "notificationId must be a string if provided" },
        { status: 400 }
      );
    }

    debugLog("✅ All validations passed, sending notification", {
      fid,
      title: title.substring(0, 50) + (title.length > 50 ? "..." : ""),
      bodyPreview: messageBody.substring(0, 50) + (messageBody.length > 50 ? "..." : ""),
      targetUrl,
      notificationId,
    });

    // Log environment check
    debugLog("🔍 Environment check", {
      hasUpstashUrl: Boolean(process.env.UPSTASH_REDIS_REST_URL),
      hasRedisUrl: Boolean(process.env.REDIS_URL),
      hasUpstashToken: Boolean(process.env.UPSTASH_REDIS_REST_TOKEN),
      hasRedisToken: Boolean(process.env.REDIS_TOKEN),
      runtime: process.env.NEXT_RUNTIME || "unknown",
      nodeEnv: process.env.NODE_ENV || "unknown",
    });

    // Send the notification
    const result = await sendMiniAppNotification({
      fid,
      title,
      body: messageBody,
      targetUrl,
      notificationId,
    });

    debugLog("📤 Notification send result", {
      success: Boolean(result),
      result: result ? {
        successfulTokens: result.successfulTokens?.length || 0,
        invalidTokens: result.invalidTokens?.length || 0,
        rateLimitedTokens: result.rateLimitedTokens?.length || 0,
      } : null,
    });

    if (!result) {
      debugLog("❌ No result from sendMiniAppNotification", {
        possibleReasons: [
          "No notification details found for this fid",
          "Redis connection failed",
          "Notification API request failed",
        ],
      });
      return NextResponse.json(
        { 
          error: "Failed to send notification",
          details: "No notification details found or notification service unavailable",
          fid 
        },
        { status: 404 }
      );
    }

    // Check if there were any successful sends
    if (result.successfulTokens.length === 0) {
      debugLog("⚠️ No successful token deliveries", {
        invalidTokens: result.invalidTokens.length,
        rateLimitedTokens: result.rateLimitedTokens.length,
      });
      
      let errorMessage = "Notification could not be delivered";
      if (result.invalidTokens.length > 0) {
        errorMessage += " - invalid tokens";
      }
      if (result.rateLimitedTokens.length > 0) {
        errorMessage += " - rate limited";
      }

      return NextResponse.json(
        {
          error: errorMessage,
          result,
          fid,
        },
        { status: 422 }
      );
    }

    debugLog("✅ Notification sent successfully", {
      fid,
      successCount: result.successfulTokens.length,
      title,
    });

    return NextResponse.json({
      success: true,
      result,
      message: "Notification sent successfully",
      fid,
      stats: {
        successful: result.successfulTokens.length,
        invalid: result.invalidTokens.length,
        rateLimited: result.rateLimitedTokens.length,
      },
    });

  } catch (error) {
    debugLog("💥 Unexpected error", {
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } : error,
      runtime: process.env.NEXT_RUNTIME || "unknown",
      nodeEnv: process.env.NODE_ENV || "unknown",
    });

    console.error("❌ Error sending notification:", error);
    
    // Enhanced environment debugging on error
    console.error("[SendNotification] Environment debug", {
      hasUpstashRedisUrl: Boolean(process.env.UPSTASH_REDIS_REST_URL),
      hasRedisUrl: Boolean(process.env.REDIS_URL),
      hasUpstashToken: Boolean(process.env.UPSTASH_REDIS_REST_TOKEN),
      hasRedisToken: Boolean(process.env.REDIS_TOKEN),
      runtime: process.env.NEXT_RUNTIME || "unknown",
      nodeEnv: process.env.NODE_ENV || "unknown",
      urlPreview: (process.env.UPSTASH_REDIS_REST_URL || process.env.REDIS_URL)?.substring(0, 20) + "..." || "MISSING",
    });

    return NextResponse.json(
      { 
        error: "Internal server error",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}