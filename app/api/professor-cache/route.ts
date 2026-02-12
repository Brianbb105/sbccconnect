import fs from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CACHE_FILE = path.resolve(process.cwd(), "app/data/rmp_cache.json");

export async function GET() {
  try {
    const raw = await fs.readFile(CACHE_FILE, "utf8");
    const parsed: unknown = JSON.parse(raw);

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return NextResponse.json({}, { status: 200 });
    }

    return NextResponse.json(parsed, { status: 200 });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return NextResponse.json({}, { status: 200 });
    }

    return NextResponse.json({ error: "Failed to load professor cache." }, { status: 500 });
  }
}
