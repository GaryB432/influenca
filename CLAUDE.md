# influenca

Notes for agents working in this repo. The README covers usage; this covers what the code assumes.

## Core has two entry points

`packages/core` is imported by both the CLI and the web app, and part of the web app runs in the browser. So it is split by what the code may touch, not by topic.

- `@influenca/core` (`src/index.ts`): types, filename constants and pure functions such as `summarize`, `formatDuration`, `isManifest` and `vttText`. Safe to import anywhere, including `.svelte` files.
- `@influenca/core/node` (`src/node.ts`): everything that touches the filesystem, such as `readManifest`, `updateManifest`, `listRuns` and `readJSON`. Server and CLI only.

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

## The manifest

A run folder holds the kept media, a `.vtt` beside each transcribed file, and one JSON file, `.influenca.json`, which holds everything known about the run.

- Types: `packages/core/src/manifest.ts`. `{ version: 1, createdAt, analyzedAt?, entries: ManifestEntry[] }`.
- Accession writes it once, after every file is copied or converted, and refuses to run if one already exists in the output dir. After that each step adds to the entries:
  - `transcript`, by transcribe (`packages/cli/src/transcribe.ts`, Whisper call in `whisper.ts`): `done` (`language`, `model`, `vttName`, `words`), `failed` (`model`, `reason`) or `silent`. Saved after every file, because each one cost money to make.
  - `analysis`, by analyze (`packages/cli/src/analyze.ts`, thresholds in `measure.ts`): `silentSec?` (below -40 dB for a second or more, anything with audio) and `stillSec?` (picture frozen two seconds or more, video only). Images get none. Saved once at the end, with `analyzedAt` on the manifest; `--redo` measures again and `--minimal` neither measures nor saves. Percent shares, Mb/s and word totals are worked out at print time, not stored.
  - `title` and `deleted`, by you on the web page: the `Curation` type. `title` is what you call a file once you have seen it, as you would say it, such as `Pool b-roll`; export makes a filename from it with `slug` in `packages/cli/src/export.ts`. Neither touches the file on disk, which keeps its `outputName`.
- A new thing to record about a file is a new field on the entry: in `Curation` if you set it, in `Findings` if a tool works it out.

### Saving it

- `updateManifest` in `packages/core/src/node.ts` is the one way a manifest is saved after accession, and `updateEntry` is its form for a single entry. Each save reads the file afresh, changes only what it was given and writes it back whole through a temporary file named for the process.
- That is what lets the web page, transcribe and analyze all save to one run. None of them may write from a copy it has been holding: a long job keeps its results to itself and hands them to `updateManifest` or `updateEntry` when it saves. Two saves within the same few milliseconds could still cross; that risk is accepted for a tool one person runs.

### Reading it

- `readManifest` in `packages/core/src/node.ts` is the one reader, and `listRuns` uses it. A missing manifest, one without an `entries` array, or one whose version is not `1` throws. Transcripts, analysis and curation are stored on each entry; legacy sidecars are not read.
- Entry base: `id`, `sourceName` (intake name), `outputName` (run-folder name), `bytes`, `metaSource`, optional `width`, `height`, `capturedAt`.
- `video`: `durationSec`, `fps`, `frameCount`, optional `hasAudio`, `videoCodec`.
- `audio`: `durationSec`, optional `audioCodec`, `channels`, `sampleRate`.
- `image`: `frameCount: 1`.
- `id` is the 1-based position in the name-sorted intake listing, as a string (`planEntries` in `packages/cli/src/entries.ts`). It is unique only within a run.
- `metaSource` is `"estimated"` (guessed from byte size) until ffprobe fills in real numbers, then `"ffprobe"`.
- `isManifest` checks only the envelope: version is `1` and `entries` is an array.
- `analyze` never calls OpenAI; it only reads what transcribe left on the entries.
- The web app (`apps/web`) reads the manifest and the `.vtt` files, and saves what you curate through one form action on the run page, `update`. The action checks the post's origin itself, because SvelteKit does not under `vite dev`.
