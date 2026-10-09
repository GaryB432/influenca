#!/usr/bin/env node
import { prompt } from "@optique/clack";
import { object, or } from "@optique/core/constructs";
import { map, optional, withDefault } from "@optique/core/modifiers";
import { argument, command, option } from "@optique/core/primitives";
import { string } from "@optique/core/valueparser";
import { run } from "@optique/run";

import { runAccession } from "./accession.js";
import { runAnalyze } from "./analyze.js";
import { printError } from "./theme.js";
import { runTranscribe } from "./transcribe.js";

try {
  process.loadEnvFile();
} catch {
  // no .env, fine
}

const accession = command(
  "accession",
  map(
    object({
      dryRun: option("--dry-run"),
      inDir: prompt(argument(string({ metavar: "IN_DIR" })), {
        message: "Intake folder?",
        type: "text",
      }),
      noTimestamp: option("--no-timestamp"),
      noTranscribe: option("--no-transcribe"),
      outDir: optional(option("--out-dir", string({ metavar: "PATH" }))), // defaults to INFLUENCA_MEDIA_DIR
      verbose: option("--verbose"),
    }),
    (v) => ({ ...v, command: "accession" as const }),
  ),
);

const analyze = command(
  "analyze",
  map(
    object({
      inDir: optional(argument(string({ metavar: "OUT_DIR" }))), // defaults to the latest run
      language: withDefault(option("-l", "--language", string()), "english"),
      minimal: option("--minimal"),
      redo: option("--redo"),
    }),
    (v) => ({ ...v, command: "analyze" as const }),
  ),
);

const transcribe = command(
  "transcribe",
  map(
    object({
      inDir: optional(argument(string({ metavar: "OUT_DIR" }))), // defaults to the latest run
      redo: option("--redo"),
    }),
    (v) => ({ ...v, command: "transcribe" as const }),
  ),
);

const result = await run(or(accession, transcribe, analyze), {
  programName: "influenca",
});

try {
  if (result.command === "accession") await runAccession(result);
  else if (result.command === "transcribe") await runTranscribe(result);
  else await runAnalyze(result);
} catch (thrown) {
  printError(thrown instanceof Error ? thrown.message : thrown);
  process.exitCode = 1;
}
