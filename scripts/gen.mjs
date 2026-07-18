/**
 * gen.mjs
 *
 * Render PNG frames from brand-500x500.svg using Chromium headless --screenshot,
 * then downsample to 24×24 and encode to AVI via FFmpeg (mediaforge wrapper).
 *
 * Pipeline:
 *   [ brand-500x500.svg ]
 *        │
 *        ▼  Chromium headless (500×500 — high-quality SVG rasterisation)
 *   [ frame_NNNN.png  ×24 ]
 *        │
 *        ▼  FFmpeg  scale=24:24  →  msmpeg4v3
 *   [ fixtures/micro-specimen.avi ]   ≈ 4 KB
 *
 * At 24×24 each frame is 576 pixels.  A single MPEG macroblock covers nearly the
 * full canvas, so motion vectors describe the entire pulsing monogram in one or
 * two entries per frame.  When stretched in any video player the bilinear/bicubic
 * upscale turns the micro-grid into a smooth, glowing pixel-art ballet.
 *
 * Usage (from repo root):
 *   node scripts/gen.mjs
 *
 * Requirements:
 *   - chromium-browser on PATH
 *   - ffmpeg on PATH  (or set FFMPEG_PATH env var)
 *   - pnpm install  (for mediaforge)
 */

import { execFileSync, spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";

// Ensure FFMPEG_PATH is set so mediaforge can find the binary even when
// /usr/bin is not on the inherited PATH (e.g. some CI / sandbox envs).
if (!process.env["FFMPEG_PATH"]) {
  try {
    process.env["FFMPEG_PATH"] = execFileSync("which", ["ffmpeg"], {
      encoding: "utf8",
    }).trim();
  } catch {
    process.env["FFMPEG_PATH"] = "/usr/bin/ffmpeg";
  }
}

// ── Config ────────────────────────────────────────────────────────────────────

const SVG_PATH = resolve("assets/brand-500x500.svg");
const FRAMES_DIR = resolve("/tmp/gen-avi-square/frames");
const OUTPUT_AVI = resolve("fixtures/micro-specimen.avi");

const FRAME_COUNT = 24; // how many frames to sample
const ANIM_DURATION = 4.0; // seconds — full cycle of the SVG shimmer animation
const WIDTH = 500; // capture at high res for quality downsampling
const HEIGHT = 500;
const OUT_SIZE = 24; // final output dimensions: 24×24 avatar-friendly
const FPS = 8; // 24 frames @ 8 fps = 3s clip

// ── Setup ─────────────────────────────────────────────────────────────────────

if (!existsSync(FRAMES_DIR)) mkdirSync(FRAMES_DIR, { recursive: true });

const svgContent = readFileSync(SVG_PATH, "utf8");

// ── Frame capture ─────────────────────────────────────────────────────────────

console.log(`Capturing ${FRAME_COUNT} frames via Chromium headless...`);

for (let i = 0; i < FRAME_COUNT; i++) {
  // Time offset within the animation cycle for this frame
  const t = (i / FRAME_COUNT) * ANIM_DURATION;
  const framePath = join(FRAMES_DIR, `frame_${String(i).padStart(4, "0")}.png`);

  // Build a minimal HTML page that freezes the SVG at time t
  const html = `<!DOCTYPE html>
<html>
<head>
<style>
  * { margin: 0; padding: 0; }
  body { width: ${WIDTH}px; height: ${HEIGHT}px; overflow: hidden; background: #090a15; }
  svg { display: block; width: ${WIDTH}px; height: ${HEIGHT}px; }
</style>
</head>
<body>
${svgContent}
<script>
  window.addEventListener('DOMContentLoaded', function () {
    var svg = document.querySelector('svg');
    if (svg && svg.pauseAnimations) {
      svg.pauseAnimations();
      svg.setCurrentTime(${t.toFixed(4)});
    }
  });
</script>
</body>
</html>`;

  const htmlPath = `/tmp/gen-avi-square/frame_${i}.html`;
  writeFileSync(htmlPath, html);

  // Launch Chromium in headless mode, take a screenshot, exit
  const result = spawnSync(
    "chromium-browser",
    [
      "--headless=new",
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-gpu",
      "--disable-software-rasterizer",
      `--window-size=${WIDTH},${HEIGHT}`,
      `--screenshot=${framePath}`,
      `file://${htmlPath}`,
    ],
    { stdio: "pipe", timeout: 20000 },
  );

  if (result.status !== 0) {
    console.error(
      `Frame ${i} failed:`,
      result.stderr?.toString().slice(0, 300),
    );
    process.exit(1);
  }

  unlinkSync(htmlPath);

  if (i % 4 === 0 || i === FRAME_COUNT - 1) {
    process.stdout.write(
      `  frame ${i + 1}/${FRAME_COUNT}  (t=${t.toFixed(2)}s)\n`,
    );
  }
}

console.log(
  `\nAll ${FRAME_COUNT} frames captured. Encoding AVI with FFmpeg via mediaforge...`,
);

// ── Encode ────────────────────────────────────────────────────────────────────
//
// mediaforge is a fluent TypeScript wrapper around the system ffmpeg binary.
// It must be resolved from the repo's node_modules, so run this script from
// the repo root (not from inside scripts/).
//
// Equivalent raw ffmpeg command:
//   ffmpeg -y -framerate 8 -i /tmp/gen-avi-square/frames/frame_%04d.png \
//          -vf scale=24:24 -vcodec msmpeg4v3 -q:v 4 fixtures/micro-specimen.avi
//
// Codec notes:
//   msmpeg4v3  (MP43)  — Microsoft MPEG-4 v3, native AVI codec, wide compat
//   scale=24:24        — downsample 500×500 → 24×24; Lanczos by default in ffmpeg
//   q:v 4              — quality scale 1–31 (lower = better); tighter at 24px

const { ffmpeg } = await import("mediaforge");

await ffmpeg()
  .input(join(FRAMES_DIR, "frame_%04d.png"), { frameRate: FPS })
  .output(OUTPUT_AVI)
  .videoFilter(`scale=${OUT_SIZE}:${OUT_SIZE}`)
  .videoCodec("msmpeg4v3")
  .addOutputOption("-q:v", "4")
  .overwrite()
  .run();

const size = statSync(OUTPUT_AVI).size;
console.log(`\n✅  ${OUTPUT_AVI}`);
console.log(`   Size   : ${(size / 1024).toFixed(1)} KB`);
console.log(
  `   Frames : ${FRAME_COUNT} @ ${FPS} fps = ${(FRAME_COUNT / FPS).toFixed(1)}s`,
);
console.log(
  `   Canvas : ${OUT_SIZE}×${OUT_SIZE} px  (downsampled from ${WIDTH}×${HEIGHT} source)`,
);
console.log(`   Codec  : MS-MPEG4 v3 (MP43) in AVI container`);
