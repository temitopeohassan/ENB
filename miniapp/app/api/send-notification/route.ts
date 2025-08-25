import { NextRequest, NextResponse } from "next/server";
import { sendMiniAppNotification } from "@/lib/miniapp-notification";

export const runtime = "edge"; // or "nodejs" if needed
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fid, title, body: messageBody, targetUrl, notificationId } = body;

    if (!fid || !title || !messageBody || !targetUrl) {
      return NextResponse.json(
        { error: "Missing required fields: fid, title, body, targetUrl" },
        { status: 400 }
      );
    }

    const result = await sendMiniAppNotification({
      fid,
      title,
      body: messageBody,
      targetUrl,
      notificationId,
    });

    if (!result) {
      return NextResponse.json(
        { error: "Failed to send notification" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      result,
      message: "Notification sent successfully",
    });
  } catch (error) {
    console.error("❌ Error sending notification:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
