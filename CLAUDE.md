# influenca

Notes for agents working in this repo. The README covers usage; this covers what the code assumes.

## The JSON files in a run folder

A run folder holds the kept media plus three hidden JSON files. The manifest is the source of truth; the other two are sidecars that point into it by entry `id`. Each file has exactly one writer.

### `.influenca.json` — the manifest

- Types: `packages/core/src/manifest.ts`. Writer: `runAccession` in `packages/cli/src/accession.ts`.
- `{ version: 1, createdAt, entries: ManifestEntry[] }`.
- Written once, after every file is copied or converted, and never edited after. Accession refuses to run if one already exists in the output dir.
- Entry base: `id`, `sourceName` (intake name), `outputName` (run-folder name), `bytes`, `metaSource`, optional `width`, `height`, `capturedAt`.
- `video`: `durationSec`, `fps`, `frameCount`, optional `hasAudio`, `videoCodec`.
- `audio`: `durationSec`, optional `audioCodec`, `channels`, `sampleRate`.
- `image`: `frameCount: 1`.
- `id` is the 1-based position in the name-sorted intake listing, as a string (`planEntries` in `packages/cli/src/entries.ts`). It is unique only within a run.
- `metaSource` is `"estimated"` (guessed from byte size) until ffprobe fills in real numbers, then `"ffprobe"`.
- `isManifest` checks only the envelope: version 1 and `entries` is an array.

### `.influenca.analysis.json` — analyze's findings

- Types: `packages/core/src/analysis.ts`. Writer: `measureRun` in `packages/cli/src/analyze.ts`. Thresholds: `packages/cli/src/measure.ts`.
- `{ version: 1, createdAt, entries: Record<entryId, EntryAnalysis> }`.
- `EntryAnalysis` has only `silentSec?` (below -40 dB for a second or more, anything with audio) and `stillSec?` (picture frozen two seconds or more, video only). Images get no entry.
- A disposable cache: reused if present, `--redo` measures again, `--minimal` neither reads nor writes it.
- Written whole at the end via `.tmp` then rename.
- Percent shares, Mb/s and word counts are computed at print time, not stored.

### `.influenca.transcripts.json` — transcribe's record

- Types: `packages/core/src/transcripts.ts`. Writer: `packages/cli/src/transcribe.ts`, with the Whisper call in `whisper.ts`.
- Same envelope, keyed by entry `id`. Each value is `done` (`language`, `model`, `vttName`, `words`), `failed` (`model`, `reason`) or `silent`.
- Saved after every file, because each one cost money to make.

### Reading them

- Readers are in `packages/core/src/node.ts`, kept apart from the main entry so browser code can import core.
- A missing or wrong-version manifest throws. A missing or wrong-version sidecar reads as `undefined`.
- `analyze` joins all three and never calls OpenAI.
- The web app (`apps/web`) reads all three plus the `.vtt` files, and writes nothing. `/media/...` serves kept files with byte ranges; `/poster/...` makes a JPEG frame with ffmpeg.
