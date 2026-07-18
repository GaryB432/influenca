/**
 * gen.mjs
 *
 * Render PNG frames from brand-500x120.svg using Chromium headless --screenshot,
 * then encode to AVI via FFmpeg (mediaforge wrapper).
 *
 * Strategy: for each frame i, write a tiny HTML page that:
 *   1. Embeds the SVG
 *   2. On DOMContentLoaded, pauses SMIL animations and seeks to time t = i/N * duration
 * Then run `chromium-browser --screenshot` on that file.
 * Finally, stitch frames into an AVI.
 *
 * Usage (from repo root):
 *   node scripts/gen.mjs
 *
 * Requirements:
 *   - chromium-browser on PATH
 *   - ffmpeg on PATH  (or set FFMPEG_PATH env var)
 *   - pnpm install  (for mediaforge)
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync, unlinkSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

// ── Config ────────────────────────────────────────────────────────────────────

const SVG_PATH   = resolve('assets/brand-500x120.svg');
const FRAMES_DIR = resolve('/tmp/gen-avi/frames');
const OUTPUT_AVI = resolve('assets/brand-500x120.avi');

const FRAME_COUNT   = 24;   // how many frames to sample
const ANIM_DURATION = 4.0;  // seconds — full cycle of the SVG shimmer animation
const WIDTH         = 500;
const HEIGHT        = 120;
const FPS           = 8;    // 24 frames @ 8 fps = 3s clip

// ── Setup ─────────────────────────────────────────────────────────────────────

if (!existsSync(FRAMES_DIR)) mkdirSync(FRAMES_DIR, { recursive: true });

const svgContent = readFileSync(SVG_PATH, 'utf8');

// ── Frame capture ─────────────────────────────────────────────────────────────

console.log(`Capturing ${FRAME_COUNT} frames via Chromium headless...`);

for (let i = 0; i < FRAME_COUNT; i++) {
  // Time offset within the animation cycle for this frame
  const t = (i / FRAME_COUNT) * ANIM_DURATION;
  const framePath = join(FRAMES_DIR, `frame_${String(i).padStart(4, '0')}.png`);

  // Build a minimal HTML page that freezes the SVG at time t
  const html = `<!DOCTYPE html>
<html>
<head>
<style>
  * { margin: 0; padding: 0; }
  body { width: ${WIDTH}px; height: ${HEIGHT}px; overflow: hidden; background: #090a15; }
  svg { display: block; }
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

  const htmlPath = `/tmp/gen-avi/frame_${i}.html`;
  writeFileSync(htmlPath, html);

  // Launch Chromium in headless mode, take a screenshot, exit
  const result = spawnSync('chromium-browser', [
    '--headless=new',
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-gpu',
    '--disable-software-rasterizer',
    `--window-size=${WIDTH},${HEIGHT}`,
    `--screenshot=${framePath}`,
    `file://${htmlPath}`
  ], { timeout: 20000, stdio: 'pipe' });

  if (result.status !== 0) {
    console.error(`Frame ${i} failed:`, result.stderr?.toString().slice(0, 300));
    process.exit(1);
  }

  unlinkSync(htmlPath);

  if (i % 4 === 0 || i === FRAME_COUNT - 1) {
    process.stdout.write(`  frame ${i + 1}/${FRAME_COUNT}  (t=${t.toFixed(2)}s)\n`);
  }
}

console.log(`\nAll ${FRAME_COUNT} frames captured. Encoding AVI with FFmpeg via mediaforge...`);

// ── Encode ────────────────────────────────────────────────────────────────────
//
// mediaforge is a fluent TypeScript wrapper around the system ffmpeg binary.
// It must be resolved from the repo's node_modules, so run this script from
// the repo root (not from inside scripts/).
//
// Equivalent raw ffmpeg command:
//   ffmpeg -y -framerate 8 -i /tmp/gen-avi/frames/frame_%04d.png \
//          -vcodec msmpeg4v3 -q:v 8 assets/brand-500x120.avi
//
// Codec notes:
//   msmpeg4v3  (MP43)  — Microsoft MPEG-4 v3, native AVI codec, wide compat
//   q:v 8              — quality scale 1–31 (lower = better); 8 is fine at
//                        this resolution and keeps the file tiny

const { ffmpeg } = await import('mediaforge');

await ffmpeg(join(FRAMES_DIR, 'frame_%04d.png'))
  .addInputOption('-framerate', String(FPS))
  .output(OUTPUT_AVI)
  .videoCodec('msmpeg4v3')
  .addOutputOption('-q:v', '8')
  .addOutputOption('-y')
  .run();

const size = statSync(OUTPUT_AVI).size;
console.log(`\n✅  ${OUTPUT_AVI}`);
console.log(`   Size   : ${(size / 1024).toFixed(1)} KB`);
console.log(`   Frames : ${FRAME_COUNT} @ ${FPS} fps = ${(FRAME_COUNT / FPS).toFixed(1)}s`);
console.log(`   Codec  : MS-MPEG4 v3 (MP43) in AVI container`);
