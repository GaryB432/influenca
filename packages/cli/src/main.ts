import { cancel, isCancel, outro, text } from "@clack/prompts";
import { cac } from "cac";

import { progress } from "./utils/meter.js";
import path from "node:path";

import { AccessionCommand } from "./commands/accession-command.js";
import { AnalyzeCommand } from "./commands/analyze-command.js";
import { setupEnvironment } from "./environment.js";
import { type GreetWorkflowOptions, runGreet } from "./workflows/greet.js";

const accessionCommand = new AccessionCommand();
const analyzeCommand = new AnalyzeCommand();

type AccessionOptions = {
  dryRun: boolean;
  openAiKey: string;
  outDir: string;
  timestamp: boolean;
  transcribe: boolean;
  verbose: boolean;
} & CommonInteractiveOptions;

type AnalyzeOptions = {
  minimal: boolean;
};

type CommonInteractiveOptions = {
  interactive: boolean;
};

type GreetOptions = {
  offset: number | string;
} & GreetWorkflowOptions;

export function getOpenAiApiKey(
  explicitKey: string | undefined,
): string | symbol {
  const apiKeyToUse = explicitKey ?? process.env.OPENAI_API_KEY;
  if (!apiKeyToUse) {
    return Symbol.for("clack:cancel");
  }
  return apiKeyToUse;
}

export async function main(rawArguments: string[]): Promise<void> {
  setupEnvironment();

  const cli = cac("influenca");

  cli
    .command("greet [name]", "Greet someone")
    .option(
      "-o, --offset <hours>",
      "UTC offset hours (use --offset=-6 for negatives)",
    )
    .option("--interactive", "Show interactive prompts")
    .example("greet bob --no-interactive --offset=-6")
    .example("greet alice --offset=-6")
    .action(async (name: string | undefined, options: GreetOptions) => {
      await runGreet(name, options);
    });

  cli
    .command("accession [inDir]", "Process media inputs and emit a manifest")
    .option("--out-dir <path>", "Output directory")
    .option("--timestamp", "Append timestamp to --out-dir", { default: true })
    .option("--verbose", "Log each processing step")
    .option("--dry-run", "Preview matching files without writing output")
    .option("--open-ai-key <key>", "Override OPENAI_API_KEY for transcription")
    .option("--transcribe", "Enable transcription", { default: true })
    .option("--interactive", "Show interactive prompts", {
      default: true,
    })
    .example("accession ./camera/drop --dry-run")
    .example(
      "accession ./camera/drop --out-dir ./tmp/demo --transcribe --no-timestamp",
    )
    .action(async (inDir: string | undefined, options: AccessionOptions) => {
      await runAccession(inDir, options);
    });

  cli
    .command("analyze [inDir]", "Summarize .influenca.json in a directory")
    .option("--minimal", "Print only video-count summary", { default: true })
    .example("analyze ./tmp/processed")
    .example("analyze ./tmp/processed --no-minimal")
    .action(async (inDir: string | undefined, options: AnalyzeOptions) => {
      await runAnalyze(inDir, options);
    });

  const parsedArgs = cli.parse(rawArguments, { run: false });

  cli.help();
  if (parsedArgs.options.help) {
    cli.outputHelp();
    return;
  }

  if (cli.matchedCommand) {
    await cli.runMatchedCommand();
  } else {
    cli.outputHelp();
  }
}

function isoTimestampNow(): string {
  return new Date(Date.now()).toISOString();
}

async function resolveAccessionInDir(options: {
  inDir: string | undefined;
  interactive: boolean;
}): Promise<null | string> {
  const candidate = options.inDir;

  if (candidate) {
    return candidate;
  }

  if (!options.interactive) {
    return null;
  }

  const response = await text({
    ...withDefaultValue(candidate),
    message: "Input directory to process",
    placeholder: "./camera/drop",
    validate(value) {
      if (!value) {
        return "Input directory is required.";
      }
      return;
    },
  });

  if (isCancel(response)) {
    cancel("Accession cancelled.");
    return null;
  }

  return response;
}

async function resolveAccessionOutDir(options: {
  interactive: boolean;
  outDir: string;
}): Promise<string | symbol> {
  const envOutDir = process.env.INFLUENCA_DIR;
  const candidate = options.outDir ?? envOutDir;

  if (candidate) {
    return candidate;
  }

  if (!options.interactive) {
    return Symbol.for("clack:cancel");
  }

  const response = await text({
    ...withDefaultValue(candidate),
    message: "Output directory",
    placeholder: "./cloud/influenca",
    validate(value) {
      if (!value) {
        return "Output directory is required.";
      }
    },
  });

  if (isCancel(response)) {
    cancel("Accession cancelled.");
  }

  return response;
}

function resolveFinalOutDir(
  outDir: string | symbol,
  timestamp: boolean,
): string | symbol {
  if (!outDir || isCancel(outDir)) {
    return Symbol.for("clack:cancel");
  }

  if (!timestamp) {
    return outDir;
  }

  return path.join(outDir, isoTimestampNow());
}

async function runAccession(
  inDir: string | undefined,
  options: AccessionOptions,
): Promise<void> {
  // const proper_progress_meter: null | ReturnType<typeof progress> = null;

  const interactive = options.interactive !== false;

  const resolvedInDir = await resolveAccessionInDir({
    inDir,
    interactive,
  });
  if (!resolvedInDir) {
    throwValidationError(
      "inDir is required in --no-interactive mode. Provide [inDir].",
    );
  }

  const resolvedOutDir = await resolveAccessionOutDir({
    interactive,
    outDir: options.outDir,
  });

  const finalOutDir = resolveFinalOutDir(resolvedOutDir, options.timestamp);

  if (isCancel(finalOutDir)) {
    throwValidationError(
      "outDir is required in --no-interactive mode. Provide --out-dir or INFLUENCA_DIR.",
    );
  }

  const openAiKey = getOpenAiApiKey(options.openAiKey);

  if (isCancel(openAiKey)) {
    throwValidationError(
      "openAiKey is required in --no-interactive mode. Provide --open-ai-key or OPENAI_API_KEY.",
    );
  }

  const message = await accessionCommand.execute(
    {
      args: [resolvedInDir],
      options: {
        ...options,
        openAiKey,
        outDir: finalOutDir,
      },
    },
    {
      meter: progress,
      onProgress() {
        throw new Error("use the other one!");
      },
    },
  );

  console.log(message, "should prolly be outtro but that breaks tests");
}

async function runAnalyze(
  inDir: string | undefined,
  options: AnalyzeOptions,
): Promise<void> {
  if (!inDir) {
    throwValidationError("inDir is required. Provide [inDir].");
  }

  const message = await analyzeCommand.execute({
    args: [inDir],
    options: {
      minimal: options.minimal ?? true,
    },
  });

  outro(message);
}

function throwValidationError(message: string): never {
  throw new Error(message);
}

function withDefaultValue(value: string | undefined): {
  defaultValue?: string;
} {
  if (typeof value === "string") {
    return { defaultValue: value };
  }
  return {};
}
