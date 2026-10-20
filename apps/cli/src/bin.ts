#!/usr/bin/env node
import { prompt } from "@optique/clack";
import { object, or } from "@optique/core/constructs";
import { dependency } from "@optique/core/dependency";
import {
  commandLine,
  envVar,
  lineBreak,
  message,
  optionName,
} from "@optique/core/message";
import { map, multiple, optional, withDefault } from "@optique/core/modifiers";
import {
  argument,
  command,
  flag,
  negatableFlag,
  option,
} from "@optique/core/primitives";
import { string } from "@optique/core/valueparser";
import { derivePromptConfig } from "@optique/prompt";
import { run } from "@optique/run";

import { invocation } from "./app/invocation.js";
import { latestRun, mediaDir } from "./app/paths.js";
import { runChoices, titledChoices } from "./app/pick.js";
import { runAccession } from "./app/runners/accession.js";
import { runAnalyze } from "./app/runners/analyze.js";
import { runExport } from "./app/runners/export.js";
import { printError } from "./app/theme.js";
import { runTranscribe } from "./app/transcribe.js";

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

// The tick list below is made from the run, so the run is something it can depend on.
const exportRun = dependency(string({ metavar: "RUN_DIR" }));
// So is the tag, which narrows it.
const exportTag = dependency(string({ metavar: "TAG" }));
// The runs to offer when export is not told which. Read here, and only for export,
// because a prompt's choices have to be in hand when the parser is put together.
const runs = process.argv[2] === "export" ? await runChoices() : [];

const exporting = command(
  "export",
  map(
    object({
      // Blank when nobody is there to ask: runExport then takes the newest run.
      inDir: prompt(
        argument(exportRun, {
          description: message`A run folder. Left off, you are asked which run under ${envVar("INFLUENCA_MEDIA_DIR")}.`,
        }),
        {
          message: "Export from which run?",
          options: runs,
          otherwise: "",
          type: "select",
          when: () => process.stdin.isTTY === true && runs.length > 0,
        },
      ),
      to: prompt(
        option("--to", string({ metavar: "DIR" }), {
          description: message`The folder to copy into. Made if it is not there.`,
        }),
        { message: "Copy the titled files to which folder?", type: "text" },
      ),
      tag: optional(
        option("--tag", exportTag, {
          description: message`Copy only the titled files with this tag.`,
        }),
      ),
      // Which files is a question for a person at a terminal; a script gets them all.
      only: prompt(
        multiple(
          option("--only", string({ metavar: "ID" }), {
            description: message`Copy just this file, by its number. Give it again for more.`,
          }),
          { min: 1 },
        ),
        derivePromptConfig(
          [exportRun, exportTag],
          async ([given, tag]) => {
            const options = await titledChoices(
              given || (await latestRun(mediaDir())),
              tag || undefined,
            );
            return {
              message: "Copy which? Space ticks one, a ticks them all.",
              options,
              // With one named file or none there is nothing to choose between, so nothing is asked.
              ...(options.length < 2 && {
                prompter: () => Promise.resolve(options.map((o) => o.value)),
              }),
              required: options.length > 0,
              type: "multiselect" as const,
            };
          },
          {
            defaultValues: () => ["", ""] as const,
            otherwise: [],
            when: () => process.stdin.isTTY === true,
          },
        ),
      ),
      subtitles: withDefault(
        negatableFlag(
          { negative: ["--no-subtitles"], positive: ["--subtitles"] },
          {
            description: message`Copy the .vtt subtitle file alongside each video. Off by default.`,
          },
        ),
        false,
      ),
      fcpxml: withDefault(
        negatableFlag(
          { negative: ["--no-fcpxml"], positive: ["--fcpxml"] },
          {
            description: message`Create experimental fcpxml file. Off by default`,
          },
        ),
        false,
      ),
    }),
    (v) => ({ ...v, command: "export" as const }),
  ),
  {
    brief: message`Copy the files you have given a title into a folder, named after their titles.`,
    description: message`Takes the files of a run that have a title and are not marked deleted, and copies each out under a filename made from its title. Pass ${optionName("--tag")} to take only the ones with that tag, and ${optionName("--subtitles")} to also copy the .vtt beside each file. The run is left as it is.`,
  },
);

// Spelled the way it was started, so the usage and examples can be pasted back.
const self = invocation();
const result = await run(or(accession, transcribe, analyze, exporting), {
  brief: message`Keep media off a camera or phone, then transcribe and measure it.`,
  examples: message`${commandLine(`${self} accession /path/to/intake`)}${lineBreak()}${commandLine(`${self} accession /path/to/intake --no-transcribe --dry-run`)}${lineBreak()}${commandLine(`${self} transcribe`)}${lineBreak()}${commandLine(`${self} analyze --redo`)}${lineBreak()}${commandLine(`${self} export --to ~/projects/garden-party/media`)}${lineBreak()}${commandLine(`${self} export --to ~/projects/garden-party/interviews --tag interview`)}`,
  help: "both",
  programName: self,
  showDefault: true,
});

try {
  if (result.command === "accession") await runAccession(result);
  else if (result.command === "transcribe") await runTranscribe(result);
  else if (result.command === "export") {
    // if (exists)
    await runExport({
      ...result,
      fcpxml: result.fcpxml,
      inDir: result.inDir || undefined,
      only: result.only.length > 0 ? [...result.only] : undefined,
    });
  } else await runAnalyze(result);
} catch (thrown) {
  printError(thrown instanceof Error ? thrown.message : thrown);
  process.exitCode = 1;
}
