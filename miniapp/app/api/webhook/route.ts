import { NextRequest, NextResponse } from "next/server";
import {
  setUserNotificationDetails,
  deleteUserNotificationDetails,
} from "@/lib/miniapp-notification";

export const dynamic = "force-dynamic";
export const runtime = "edge";

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function safeLog(label: string, data?: unknown) {
  const ts = new Date().toISOString();
  if (data === undefined) {
    console.log(`[WEBHOOK] ${ts} ${label}`);
    return;
  }
  const printable = isRecord(data) || Array.isArray(data) ? JSON.stringify(data) : String(data);
  console.log(`[WEBHOOK] ${ts} ${label}`);
  console.log(printable);
}

function decodeBase64ToObject(payload: string): JsonRecord | null {
  try {
    let decodedStr: string;
    if (typeof Buffer !== "undefined") {
      decodedStr = Buffer.from(payload, "base64").toString("utf-8");
    } else if (typeof atob !== "undefined") {
      const bytes = Uint8Array.from(atob(payload), (c) => c.charCodeAt(0));
      decodedStr = new TextDecoder().decode(bytes);
    } else {
      return null;
    }
    const parsed = JSON.parse(decodedStr);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function parseEnvelope(body: unknown): JsonRecord {
  if (isRecord(body)) {
    const rawPayload = body["payload"];
    if (typeof rawPayload === "string") {
      const decoded = decodeBase64ToObject(rawPayload);
      if (decoded) return decoded;
    }
    if (isRecord(rawPayload)) {
      return rawPayload;
    }
    if (typeof body["event"] === "string") {
      return body as JsonRecord;
    }
  }
  return {};
}

function extractEventFields(source: JsonRecord) {
  const eventName = ((): string | null => {
    const raw = source["event"] ?? source["type"] ?? source["name"];
    return typeof raw === "string" ? raw : null;
  })();

  const fid = ((): number | null => {
    const candidates = [
      source["fid"],
      isRecord(source["user"]) ? source["user"]["fid"] : undefined,
      source["viewerFid"],
      source["viewer_fid"],
      source["userId"],
      source["user_id"],
    ];
    for (const v of candidates) {
      if (typeof v === "number") return v;
    }
    return null;
  })();

  const detailsObj = ((): JsonRecord | null => {
    const d = source["notificationDetails"] ?? source["notification"];
    return isRecord(d) ? d : null;
  })();

  const token = ((): string | null => {
    const v = detailsObj?.["token"];
    return typeof v === "string" ? v : null;
  })();

  const url = ((): string | null => {
    const v = detailsObj?.["url"];
    return typeof v === "string" ? v : null;
  })();

  const name = (eventName || "").toLowerCase();
  const isUpsert = ["miniapp_added", "notifications_enabled", "frame_added"].includes(name);
  const isRemove = ["miniapp_removed", "notifications_disabled", "frame_removed"].includes(name);
  const action: "upsert" | "remove" | null = isUpsert ? "upsert" : isRemove ? "remove" : null;

  return { action, fid, token, url, eventName: name };
}

function getFidFromHeader(rawBody: unknown): number | null {
  if (!isRecord(rawBody)) return null;
  const header = rawBody["header"];
  if (typeof header !== "string") return null;
  const decoded = decodeBase64ToObject(header);
  if (decoded && typeof decoded["fid"] === "number") {
    return decoded["fid"] as number;
  }
  return null;
}

function getOverrideFid(req: NextRequest, rawBody: unknown): number | null {
  // Allow test overrides: header x-test-fid, top-level body.fid, or body.payload.fid (object)
  const headerVal = req.headers.get("x-test-fid");
  if (headerVal) {
    const n = Number(headerVal);
    if (Number.isFinite(n) && n > 0) return n;
  }
  if (isRecord(rawBody)) {
    const top = rawBody["fid"];
    if (typeof top === "number" && top > 0) return top;
    const payload = rawBody["payload"];
    if (isRecord(payload) && typeof payload["fid"] === "number" && (payload["fid"] as number) > 0) {
      return payload["fid"] as number;
    }
  }
  return null;
}

export async function POST(req: NextRequest) {
  try {
    safeLog("🚀 Webhook POST request received");
    safeLog("Request info", { method: req.method, url: req.url });

    const rawBody = (await req.json().catch(() => null)) as unknown;
    if (!rawBody) {
      return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
    }
    safeLog("📥 Raw request body", rawBody);

    const eventObject = parseEnvelope(rawBody);
    safeLog("🔍 Parsed event object keys", Object.keys(eventObject));

    const extracted = extractEventFields(eventObject);
    let fid = extracted.fid;
    const { action, token, url, eventName } = extracted;
    const overrideFid = getOverrideFid(req, rawBody);
    if (fid === null && overrideFid !== null) {
      fid = overrideFid;
      safeLog("🧪 Using override fid from request for testing", { fid });
    }
    if (fid === null) {
      const headerFid = getFidFromHeader(rawBody);
      if (headerFid !== null) {
        fid = headerFid;
        safeLog("🔎 Extracted fid from header", { fid });
      }
    }
    safeLog("📊 Extracted fields", { event: eventName, fid, hasToken: Boolean(token), hasUrl: Boolean(url), action });

    if (action === "upsert") {
      if (fid !== null && token && url) {
        await setUserNotificationDetails({ fid }, { token, url });
        safeLog("✅ Stored notification details", { fid });
        return NextResponse.json({ ok: true });
      }
      safeLog("⚠️ Upsert missing fields", { fidPresent: fid !== null, tokenPresent: Boolean(token), urlPresent: Boolean(url) });
      return NextResponse.json({ ok: true, ignored: true });
    }

    if (action === "remove") {
      if (fid !== null) {
        await deleteUserNotificationDetails({ fid });
        safeLog("🗑️ Deleted notification details", { fid });
        return NextResponse.json({ ok: true });
      }
      safeLog("⚠️ Remove missing fid");
      return NextResponse.json({ ok: true, ignored: true });
    }

    safeLog("ℹ️ Unknown or unsupported event", { event: eventName });
    return NextResponse.json({ ok: true, ignored: true });
  } catch (error) {
    safeLog("💥 Error handling webhook", error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : String(error));
    return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}