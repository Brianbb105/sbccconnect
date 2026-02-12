import { NextResponse } from "next/server";
import { readSummary, recordEvent } from "@/lib/analyticsStore";

export const runtime = "nodejs";

const MAX_EVENT_LENGTH = 80;
const MAX_PATH_LENGTH = 200;

function sanitize(input: unknown, fallback: string, maxLength: number): string {
  if (typeof input !== "string") {
    return fallback;
  }

  const trimmed = input.trim().slice(0, maxLength);
  if (!trimmed) {
    return fallback;
  }

  // Keep labels readable and avoid storing unbounded data.
  return trimmed.replace(/[^a-zA-Z0-9:/?&_.\- ]/g, "");
}

export async function POST(request: Request) {
  let payload: unknown = null;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const body = payload as Record<string, unknown>;
  const event = sanitize(body.event, "unknown_event", MAX_EVENT_LENGTH);
  const path = sanitize(body.path, "unknown_path", MAX_PATH_LENGTH);

  try {
    await recordEvent(event, path);
  } catch {
    return NextResponse.json({ error: "Failed to persist analytics event." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function GET() {
  try {
    return NextResponse.json(await readSummary());
  } catch {
    return NextResponse.json({ error: "Failed to read analytics data." }, { status: 500 });
  }
}
