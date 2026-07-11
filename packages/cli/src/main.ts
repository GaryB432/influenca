import { cancel, intro, isCancel, outro, text } from "@clack/prompts";
import { cac } from "cac";

import { AnalyzeCommand } from "./commands/analyze-command.js";
import { AscessionCommand } from "./commands/ascession-command.js";
import { setupEnvironment } from "./environment.js";

const ascessionCommand = new AscessionCommand();
const analyzeCommand = new AnalyzeCommand();

type AscessionOptions = {
  output: string;
} & CommonInteractiveOptions;

type CommonInteractiveOptions = {
  dryRun?: boolean;
  interactive?: string;
};

setupEnvironment();

export async function main(rawArguments: string[]): Promise<void> {
  intro("📸 Influenca");

  const cli = cac("my-cli");

  cli
    .command(
      "ascession [inputDir]",
      "Convert AVI videos to MP4 and catalog them",
    )
    .option("-d, --dry-run", "Do not write to disk")
    .option("-o, --output <path>", "Output directory for MP4s and manifest")
    .example("ascession ~/dogfood/videos_raw --output ~/dogfood/videos")
    .action(async (inputDir: string | undefined, options: AscessionOptions) => {
      await runAscession(inputDir, options);
    });

  cli
    .command("analyze [inputDir]", "Analyze a manifest directory")
    .example("analyze ./fixtures/vidz")
    .action(async (inputDir: string | undefined) => {
      await runAnalyze(inputDir);
    });

  const parsedArgs = cli.parse(rawArguments, { run: false });

  cli.help();
  if (parsedArgs.options.help) {
    cli.outputHelp();
    return;
  }

  if (cli.matchedCommand) {
    await cli.runMatchedCommand();
    outro("Done! 🎉");
  } else {
    cli.outputHelp();
  }
}

async function runAnalyze(inputDir: string | undefined): Promise<void> {
  let currentDir = inputDir ?? process.env.INFLUENCA_MEDIA;

  while (true) {
    if (currentDir) {
      try {
        const result = await analyzeCommand.execute({
          args: [currentDir],
          options: {},
        });
        console.log(result);
        return;
      } catch (error) {
        // If it's a file not found or JSON parse error, we continue the loop to prompt again
        if (
          error instanceof Error &&
          (error.message.includes("ENOENT") ||
            error.message.includes("Unexpected token"))
        ) {
          // continue to prompt
        } else {
          throw error;
        }
      }
    }

    const response = await text({
      defaultValue: "",
      message: "Please enter the path to the manifest directory",
      placeholder: "./media",
    });

    if (isCancel(response)) {
      cancel("Analysis cancelled.");
      return;
    }

    currentDir = response;
  }
}

async function runAscession(
  inputDir: string | undefined,
  options: AscessionOptions,
): Promise<void> {
  let currentInputDir = inputDir ?? process.env.INFLUENCA_MEDIA;
  let currentOutputDir = options.output ?? process.env.INFLUENCA_MEDIA;

  if (!currentInputDir) {
    const response = await text({
      message: "Please enter the input directory containing AVI files",
      placeholder: "./videos_raw",
      validate(value) {
        if (!value || value.trim().length === 0) {
          return "Enter AVI directory";
        }
      },
    });

    if (isCancel(response)) {
      cancel("Ascession cancelled.");
      return;
    }
    currentInputDir = response;
  }

  if (!currentOutputDir) {
    const response = await text({
      message: "Please enter the output directory for MP4s and manifest",
      placeholder: "./videos",
      validate(value) {
        if (!value || value.trim().length === 0) {
          return "Enter MP4 directory";
        }
      },
    });

    if (isCancel(response)) {
      cancel("Ascession cancelled.");
      return;
    }
    currentOutputDir = response;
  }

  try {
    const result = await ascessionCommand.execute({
      args: [currentInputDir],
      options: { ...options, output: currentOutputDir },
    });
    console.log(result);
  } catch (error) {
    console.error(
      "Error:",
      error instanceof Error ? error.message : String(error),
    );
  }
}
