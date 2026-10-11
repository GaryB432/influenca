#!/usr/bin/env node
import { prompt } from "@optique/clack";
import { object, or } from "@optique/core/constructs";
import {
  commandLine,
  envVar,
  lineBreak,
  message,
  optionName,
} from "@optique/core/message";
import { map, optional, withDefault } from "@optique/core/modifiers";
import {
  argument,
  command,
  flag,
  negatableFlag,
  option,
} from "@optique/core/primitives";
import { string } from "@optique/core/valueparser";
import { run } from "@optique/run";

import { runAccession } from "./accession.js";
import { runAnalyze } from "./analyze.js";
import { runExport } from "./export.js";
import { invocation } from "./invocation.js";
import { latestRun, mediaDir } from "./paths.js";
import { pickNamed } from "./pick.js";
import { printError } from "./theme.js";
import { runTranscribe } from "./transcribe.js";

try {
  process.loadEnvFile();
} catch {
  // no .env, fine
}

// The order of the keys below is the order of the usage line and the help, so it is
// chosen for reading: what the command works on, where the result goes, what it does
// next, and last how it runs.

const accession = command(
  "accession",
  map(
    object({
      inDir: prompt(
        argument(string({ metavar: "IN_DIR" }), {
          description: message`The intake folder. Only its top level is read, and it is never changed.`,
        }),
        { message: "Intake folder?", type: "text" },
      ),
      outDir: optional(
        option("--out-dir", string({ metavar: "PATH" }), {
          description: message`Where runs are kept. Defaults to ${envVar("INFLUENCA_MEDIA_DIR")}.`,
        }),
      ),
      timestamp: withDefault(
        negatableFlag(
          { negative: ["--no-timestamp"], positive: ["--timestamp"] },
          {
            description: message`Give the run a time-stamped folder of its own inside ${optionName("--out-dir")}. On unless switched off.`,
          },
        ),
        true,
      ),
      transcribe: withDefault(
        negatableFlag(
          { negative: ["--no-transcribe"], positive: ["--transcribe"] },
          {
            description: message`Send what is said in each file to OpenAI and keep it as subtitles. On unless switched off.`,
          },
        ),
        true,
      ),
      dryRun: option("--dry-run", {
        description: message`Show what would be kept and write nothing.`,
      }),
      verbose: option("--verbose", {
        description: message`Also list the files that are left behind.`,
      }),
    }),
    (v) => ({ ...v, command: "accession" as const }),
  ),
  {
    brief: message`Keep the supported files of an intake folder as a new run.`,
    description: message`Copies or converts each supported file into a new run folder, writes the manifest of what was kept, then transcribes it.`,
  },
);

const runDir = () =>
  optional(
    argument(string({ metavar: "RUN_DIR" }), {
      description: message`A run folder. Defaults to the newest run under ${envVar("INFLUENCA_MEDIA_DIR")}.`,
    }),
  );

const transcribe = command(
  "transcribe",
  map(
    object({
      inDir: runDir(),
      redo: option("--redo", {
        description: message`Send every file again, including those already done. This is paid for again.`,
      }),
    }),
    (v) => ({ ...v, command: "transcribe" as const }),
  ),
  {
    brief: message`Finish transcribing a run.`,
    description: message`Sends each file with sound that has no transcript yet to OpenAI, and writes what comes back beside it.`,
  },
);

const analyze = command(
  "analyze",
  map(
    object({
      inDir: runDir(),
      // One at most: --minimal measures nothing, --redo measures everything again.
      measuring: withDefault(
        or(
          map(
            flag("--minimal", {
              description: message`Print the totals from the manifest only. Measures and writes nothing.`,
            }),
            () => "minimal" as const,
          ),
          map(
            flag("--redo", {
              description: message`Measure again, replacing the saved analysis.`,
            }),
            () => "redo" as const,
          ),
        ),
        "usual" as const,
      ),
      language: withDefault(
        option("-l", "--language", string({ metavar: "NAME" }), {
          description: message`The language you expect to hear, as Whisper names it. Transcripts in another say so.`,
        }),
        "english",
      ),
    }),
    ({ measuring, ...v }) => ({
      ...v,
      command: "analyze" as const,
      minimal: measuring === "minimal",
      redo: measuring === "redo",
    }),
  ),
  {
    brief: message`Measure a run and print what it holds.`,
    description: message`Times the still and silent stretches of each file, saves them beside the manifest, and prints them with the word counts from any transcripts.`,
  },
);

const exporting = command(
  "export",
  map(
    object({
      inDir: runDir(),
      to: prompt(
        option("--to", string({ metavar: "DIR" }), {
          description: message`The folder to copy into. Made if it is not there.`,
        }),
        { message: "Copy the named files to which folder?", type: "text" },
      ),
      all: option("--all", {
        description: message`Copy every named file without asking which.`,
      }),
    }),
    (v) => ({ ...v, command: "export" as const }),
  ),
  {
    brief: message`Copy the files you have named into a folder, under those names.`,
    description: message`Takes every file of a run that has a name and is not marked deleted, and copies it out as that name, with its subtitles. The run is left as it is.`,
  },
);

// Spelled the way it was started, so the usage and examples can be pasted back.
const self = invocation();
const result = await run(or(accession, transcribe, analyze, exporting), {
  brief: message`Keep media off a camera or phone, then transcribe and measure it.`,
  examples: message`${commandLine(`${self} accession /path/to/intake`)}${lineBreak()}${commandLine(`${self} accession /path/to/intake --no-transcribe --dry-run`)}${lineBreak()}${commandLine(`${self} transcribe`)}${lineBreak()}${commandLine(`${self} analyze --redo`)}${lineBreak()}${commandLine(`${self} export --to ~/projects/garden-party/media`)}`,
  help: "both",
  programName: self,
  showDefault: true,
});

try {
  if (result.command === "accession") await runAccession(result);
  else if (result.command === "transcribe") await runTranscribe(result);
  else if (result.command === "export") {
    // Which files is a question for a person at a terminal; a script gets them all.
    const inDir = result.inDir ?? (await latestRun(mediaDir()));
    const only =
      result.all || !process.stdin.isTTY ? undefined : await pickNamed(inDir);
    await runExport({ ...result, inDir, only });
  } else await runAnalyze(result);
} catch (thrown) {
  printError(thrown instanceof Error ? thrown.message : thrown);
  process.exitCode = 1;
}
