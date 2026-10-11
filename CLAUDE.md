# influenca

Notes for agents working in this repo. The README covers usage; this covers what the code assumes.

## Core has two entry points

`packages/core` is imported by both the CLI and the web app, and part of the web app runs in the browser. So it is split by what the code may touch, not by topic.

- `@influenca/core` (`src/index.ts`): types, filename constants and pure functions such as `summarize`, `formatDuration`, `isManifest` and `vttText`. Safe to import anywhere, including `.svelte` files.
- `@influenca/core/node` (`src/node.ts`): everything that touches the filesystem, such as `readManifest`, `readAnalysis`, `readTranscripts`, `listRuns` and `readJSON`. Server and CLI only.

The rules that keep this working:

- Nothing reachable from `index.ts` may import a `node:` built-in. `json.ts` does, which is why it is exported only through `node.ts`.
- In `apps/web`, only server files (`+page.server.ts`, `+server.ts`, anything under `src/lib/server`) may import `@influenca/core/node`. A `.svelte` file or a plain `+page.ts` may not.
- Nothing enforces either rule. A wrong import shows up as a failed web build or a browser error, not a lint error.

The web app has the same kind of boundary of its own: `src/lib/server` is server-only, and SvelteKit does enforce that one. Import it as `#lib/server/...` (SvelteKit 3 dropped `$lib`; the `#lib` mapping is in `apps/web/package.json`).

## Options are whole before a command runs

`runAccession`, `runTranscribe` and `runAnalyze` take a typed options object that is already complete and valid. Where it came from does not matter to them: the parser in `bin.ts`, a test, anything else. They do not prompt, re-check flags against each other or print usage, and they throw when the work itself cannot be done.

- Rules about which flags go together belong in the parser, where they also show in the usage line: `or(...)` for one-of, `negatableFlag` for on/off pairs.
- Prompting for a missing argument belongs there too, and happens before any command starts. Prompts go through optique's wrapper (`prompt` from `@optique/clack`), not clack directly; a prompt whose choices come from another argument uses `derivePromptConfig`, as `export`'s tick list does.

## How the CLI talks

Every command is laid out the same way, so intake, accession, transcribe and analyze read as one tool:

1. the folder it is working on, in the accent
2. a table with a row per file (`startTable` in `packages/cli/src/live.ts`)
3. a plain line saying what was written
4. `Next: <command>` with the command in the accent (`next` in `theme.ts`), spelled the way the CLI was started (`invocation.ts`)

- Body text is plain. The accent (cyan) is for what the reader acts on: a path, a command, the meter that is moving. Dim is for notes; yellow and red are for warnings and errors, which go to stderr.
- Print through `log`, `warn`, `printError` and `next` in `theme.ts`, never `console`.
- Nothing else may write to stdout while a table is live; put what happened to a file on its row.
- The intake scripts in `scripts/` end on the same `Next:` line.

## The JSON files in a run folder

A run folder holds the kept media plus three hidden JSON files. The manifest is the source of truth; the other two are sidecars that point into it by entry `id`. Each file has exactly one writer.

### `.influenca.json` — the manifest

- Types: `packages/core/src/manifest.ts`. Writer: `runAccession` in `packages/cli/src/accession.ts`.
- `{ version: 1, createdAt, entries: ManifestEntry[] }`.
- Written once, after every file is copied or converted. Accession refuses to run if one already exists in the output dir.
- It drives the web page, and what you set there while curating is saved back into its entries: `title` (what you call a file once you have seen it, as you would say it, such as `Pool b-roll`) and `deleted` (you do not want it). These are the `Curation` type in `packages/core/src/manifest.ts`; a new thing to record about a file is a new field there. Neither touches the file on disk, which keeps its `outputName`. Export makes a filename from the title with `slug` in `packages/cli/src/export.ts`. A manifest saved while the title was still called `name` is read as if it said `title` (`withTitles`), and is written the new way on its next save.
- `updateEntry` in `packages/core/src/node.ts` is the one function that saves a manifest after accession. It changes only the fields it is given and writes through a temporary file, so a save cut short cannot leave half a manifest.
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

- Readers are in `packages/core/src/node.ts`; see the two entry points above.
- A missing or wrong-version manifest throws. A missing or wrong-version sidecar reads as `undefined`.
- `analyze` joins all three and never calls OpenAI.
- The web app (`apps/web`) reads all three plus the `.vtt` files, and saves what you curate through one form action on the run page, `update`. The action checks the post's origin itself, because SvelteKit does not under `vite dev`.
