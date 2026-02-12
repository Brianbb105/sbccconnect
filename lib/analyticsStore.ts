import { promises as fs } from "node:fs";
import path from "node:path";

export type AnalyticsSummary = {
  totalEvents: number;
  byEvent: Record<string, number>;
  byPath: Record<string, number>;
  updatedAt: string | null;
};

const STORAGE_PATH = process.env.ANALYTICS_FILE_PATH || path.join(process.cwd(), ".analytics", "summary.json");
let writeQueue: Promise<void> = Promise.resolve();

function createInitialSummary(): AnalyticsSummary {
  return {
    totalEvents: 0,
    byEvent: {},
    byPath: {},
    updatedAt: null,
  };
}

function toSafeMap(input: unknown): Record<string, number> {
  if (!input || typeof input !== "object") {
    return {};
  }

  const source = input as Record<string, unknown>;
  const result: Record<string, number> = {};
  for (const [key, value] of Object.entries(source)) {
    if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
      result[key] = value;
    }
  }
  return result;
}

function normalizeSummary(input: unknown): AnalyticsSummary {
  if (!input || typeof input !== "object") {
    return createInitialSummary();
  }

  const raw = input as Record<string, unknown>;
  return {
    totalEvents:
      typeof raw.totalEvents === "number" && Number.isFinite(raw.totalEvents) && raw.totalEvents >= 0
        ? raw.totalEvents
        : 0,
    byEvent: toSafeMap(raw.byEvent),
    byPath: toSafeMap(raw.byPath),
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : null,
  };
}

async function readSummaryFromDisk(): Promise<AnalyticsSummary> {
  try {
    const file = await fs.readFile(STORAGE_PATH, "utf8");
    return normalizeSummary(JSON.parse(file));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return createInitialSummary();
    }
    throw error;
  }
}

async function writeSummaryToDisk(summary: AnalyticsSummary) {
  const folder = path.dirname(STORAGE_PATH);
  const tempPath = `${STORAGE_PATH}.tmp`;
  await fs.mkdir(folder, { recursive: true });
  await fs.writeFile(tempPath, JSON.stringify(summary, null, 2), "utf8");
  await fs.rename(tempPath, STORAGE_PATH);
}

function enqueueWrite(task: () => Promise<void>): Promise<void> {
  const run = writeQueue.then(task, task);
  writeQueue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

export async function recordEvent(event: string, pathName: string): Promise<void> {
  await enqueueWrite(async () => {
    const summary = await readSummaryFromDisk();
    summary.totalEvents += 1;
    summary.byEvent[event] = (summary.byEvent[event] ?? 0) + 1;
    summary.byPath[pathName] = (summary.byPath[pathName] ?? 0) + 1;
    summary.updatedAt = new Date().toISOString();
    await writeSummaryToDisk(summary);
  });
}

export async function readSummary(): Promise<AnalyticsSummary> {
  await writeQueue;
  return readSummaryFromDisk();
}
