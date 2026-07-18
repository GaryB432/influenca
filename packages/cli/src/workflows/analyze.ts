import fs from "node:fs";
import path from "node:path";

export type AnalyzeWorkflowOptions = {
  inDir: string;
  minimal: boolean;
};

export type AnalyzeWorkflowResult = {
  manifestPath: string;
  totalDurationSeconds: number;
  totalFrames: number;
  videoCount: number;
  withStatsCount: number;
};

type Manifest = Record<string, ManifestEntry>;

type ManifestEntry = {
  stats?: {
    duration_seconds?: number;
    frames?: number;
  };
};

export async function runAnalyzeWorkflow(
  options: AnalyzeWorkflowOptions,
): Promise<AnalyzeWorkflowResult> {
  const manifestPath = path.join(options.inDir, ".influenca.json");

  if (!fs.existsSync(manifestPath)) {
    throw new Error(`No manifest found at ${manifestPath}.`);
  }

  const rawManifest = fs.readFileSync(manifestPath, "utf8");
  const manifest = parseManifest(rawManifest);
  const entries = Object.values(manifest);

  let totalDurationSeconds = 0;
  let totalFrames = 0;
  let withStatsCount = 0;

  for (const entry of entries) {
    const stats = entry.stats;
    if (!stats) {
      continue;
    }

    withStatsCount += 1;
    totalDurationSeconds += toNumber(stats.duration_seconds);
    totalFrames += Math.trunc(toNumber(stats.frames));
  }

  return {
    manifestPath,
    totalDurationSeconds,
    totalFrames,
    videoCount: entries.length,
    withStatsCount,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseManifest(rawManifest: string): Manifest {
  const parsed: unknown = JSON.parse(rawManifest);
  if (!isRecord(parsed)) {
    throw new Error(".influenca.json must be a JSON object.");
  }

  const manifest: Manifest = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (!isRecord(value)) {
      manifest[key] = {};
      continue;
    }

    const statsValue = value.stats;
    if (!isRecord(statsValue)) {
      manifest[key] = {};
      continue;
    }

    manifest[key] = {
      stats: {
        duration_seconds: toNumberOrUndefined(statsValue.duration_seconds),
        frames: toNumberOrUndefined(statsValue.frames),
      },
    };
  }

  return manifest;
}

function toNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  return 0;
}

function toNumberOrUndefined(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  return undefined;
}
