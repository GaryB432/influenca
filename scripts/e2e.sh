#!/bin/sh

set -eu

cd "$(dirname "$0")/.."

fail() {
  printf '\033[1;31mFAIL: %s\033[0m\n' "$1" >&2
  exit 1
}

TIMESTAMP=$(date +%Y-%m-%d_%H-%M-%S)
IN="tmp/$TIMESTAMP/in"
OUT="tmp/$TIMESTAMP/out"

pnpm --filter @influenca/cli... run build

# One second of test pattern at 30 fps, so the probe has a known answer.
# AVI in, so the run has to convert it.
mkdir -p "$IN"
ffmpeg -v error -f lavfi -i testsrc=duration=1:rate=30:size=320x240 -c:v mjpeg "$IN/fake.avi"

# A check must not depend on, or spend, an OpenAI key.
packages/cli/dist/bin.mjs accession "$IN" --out-dir "$OUT" --no-timestamp --no-transcribe

ANALYSIS=$(packages/cli/dist/bin.mjs analyze "$OUT")
printf '%s\n' "$ANALYSIS"

cat "$OUT/.influenca.json"

ENTRIES=$(node -p 'JSON.parse(fs.readFileSync(process.argv[1], "utf8")).entries.length' "$OUT/.influenca.json")
printf '\n\033[1;34mEntries: \033[1;32m%s\033[0m\n' "$ENTRIES"

[ "$ENTRIES" -eq 1 ] || fail "expected 1 entry, got $ENTRIES"
printf '%s\n' "$ANALYSIS" | grep -qx 'Total frames: 30' || fail "expected 'Total frames: 30' from analyze"
grep -q '"metaSource": "ffprobe"' "$OUT/.influenca.json" || fail "expected the entry to be probed, not estimated"
grep -q '"videoCodec": "h264"' "$OUT/.influenca.json" || fail "expected fake.avi to be converted to H.264"
[ -s "$OUT/.influenca.analysis.json" ] || fail "expected analyze to write an analysis file"
[ -s "$OUT/fake.mp4" ] || fail "expected a converted fake.mp4 in the run folder"

printf '\033[1;32mPASS\033[0m\n'
