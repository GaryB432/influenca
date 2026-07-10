import { cancel, intro, isCancel, outro, select, text } from "@clack/prompts";
import { timeZoneUtcOffsetMinutes } from "@influenca/core/time";
import { cac } from "cac";

import { AscessionCommand } from "./commands/ascession-command.js";
import { GreetCommand } from "./commands/greet-command.js";

// import { cancel, intro, outro } from "@clack/prompts";
// import cac from "cac";
// import { Database, listMedia } from "./lib/database";
// import { resolveFolderPath } from "./lib/resolutions";
// import type { CacParsedArgv } from "./lib/types";
// import { namingWorkflow } from "./lib/workflows";

// const cli = cac();
// cli.option("--list, -l", "List Media");
// const cliOptions: CacParsedArgv = cli.parse(process.argv, { run: false });
// const [argDir] = cliOptions.args;

// intro("📸 Influenca - EXIF Metadata Viewer");
// resolveFolderPath(argDir).then(async (loc) => {
//   if (!loc) {
//     cancel("no db path was given");
//     process.exit(1);
//   }

//   let db: Database | false = false;
//   do {
//     Database.tryCreate(loc).then(
//       (d) => {
//         console.log(d);
//         db = d;
//       },
//       (q) => {
//         console.log(q);
//       },
//     );
//   } while (!db);

//   // const db = new Database(loc);
//   // await db.read();
//   if (cliOptions.options.list) {
//     listMedia(db);
//   } else {
//     await namingWorkflow(db);
//     db.write();
//   }
//   outro("Done! 🎉");
// });

const greetCommand = new GreetCommand();
const ascessionCommand = new AscessionCommand();

type AscessionOptions = {
  output: string;
} & CommonInteractiveOptions;

type CommonInteractiveOptions = {
  interactive?: string;
};

type GreetOptions = {
  offset?: number | string;
} & CommonInteractiveOptions;

type PromptMode = "always" | "auto" | "never";

export async function main(rawArguments: string[]): Promise<void> {
  intro("📸 Influenca - EXIF Metadata Viewer");

  const cli = cac("my-cli");

  cli
    .command("greet [name]", "Greet someone")
    .option(
      "-o, --offset <hours>",
      "UTC offset hours (use --offset=-6 for negatives)",
    )
    .option("--interactive <mode>", "Prompt mode: auto, yes, or no")
    .example("greet bob --interactive no --offset=-6")
    .example("greet alice --offset=-6")
    .action(async (name: string | undefined, options: GreetOptions) => {
      await runGreet(name, options);
    });

  cli
    .command(
      "ascession <inputDir>",
      "Convert AVI videos to MP4 and catalog them",
    )
    .option("-o, --output <path>", "Output directory for MP4s and manifest")
    .example("ascession ~/dogfood/videos_raw --output ~/dogfood/videos")
    .action(async (inputDir: string, options: AscessionOptions) => {
      try {
        const result = await ascessionCommand.execute({
          args: [inputDir],
          options: options,
        });
        console.log(result);
      } catch (error) {
        console.error(
          "Error:",
          error instanceof Error ? error.message : String(error),
        );
      }
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

function defaultZoneForOffset(offsetHours: number, zones: string[]): string {
  const preferredZone = preferredZoneForOffset(offsetHours);
  if (preferredZone && zones.includes(preferredZone)) {
    return preferredZone;
  }
  if (zones.includes("UTC")) {
    return "UTC";
  }
  return zones[0]!;
}

function formatOffset(offsetHours: number): string {
  if (offsetHours >= 0) {
    return `+${offsetHours}`;
  }
  return String(offsetHours);
}

function offsetHoursForZone(zone: string, now = new Date()): number {
  const offsetMinutes = timeZoneUtcOffsetMinutes(zone, now);
  if (offsetMinutes === null) {
    throwValidationError(`Time zone '${zone}' is not valid.`);
  }

  return offsetMinutes / 60;
}

function parseOffsetHours(rawOffset: number | string | undefined): number {
  if (typeof rawOffset === "number") {
    if (Number.isNaN(rawOffset)) {
      throwValidationError("--offset must be numeric.");
    }
    if (rawOffset < -12 || rawOffset > 14) {
      throwValidationError("--offset must be between -12 and 14.");
    }
    return rawOffset;
  }

  if (typeof rawOffset !== "string" || rawOffset.trim() === "") {
    throwValidationError("--offset is required and must be a number.");
  }

  const parsed = Number(rawOffset);
  if (Number.isNaN(parsed)) {
    throwValidationError("--offset must be numeric.");
  }
  if (parsed < -12 || parsed > 14) {
    throwValidationError("--offset must be between -12 and 14.");
  }

  return parsed;
}

function parsePromptMode(rawMode: string | undefined): PromptMode {
  if (typeof rawMode === "undefined") {
    return "auto";
  }

  const normalized = rawMode.trim().toLowerCase();
  if (normalized === "auto") {
    return "auto";
  }
  if (
    normalized === "yes" ||
    normalized === "true" ||
    normalized === "always"
  ) {
    return "always";
  }
  if (normalized === "no" || normalized === "false" || normalized === "never") {
    return "never";
  }

  throwValidationError("--interactive must be one of: auto, yes, no.");
}

function preferredZoneForOffset(offsetHours: number): null | string {
  const rounded = Math.round(offsetHours);
  const defaults = new Map<number, string>([
    [-5, "America/New_York"],
    [-6, "America/Chicago"],
    [-7, "America/Denver"],
    [-8, "America/Los_Angeles"],
    [0, "UTC"],
    [1, "Europe/Berlin"],
  ]);

  return defaults.get(rounded) ?? null;
}

async function resolveGreetingName(
  name: string | undefined,
  interactive: boolean,
): Promise<null | string> {
  if (!interactive) {
    return name ?? null;
  }

  const response = await text({
    ...withDefaultValue(name),
    message: "Who should we greet?",
    placeholder: "bob",
    validate(value) {
      if (!value) {
        return "Name is required.";
      }
      return;
    },
  });

  if (isCancel(response)) {
    cancel("Greeting cancelled.");
    return null;
  }

  return response;
}

async function resolveGreetingOffsetHours(options: {
  interactive: boolean;
  promptAll: boolean;
  rawOffset: number | string | undefined;
}): Promise<null | number> {
  if (
    !options.promptAll &&
    (typeof options.rawOffset === "string" ||
      typeof options.rawOffset === "number")
  ) {
    return parseOffsetHours(options.rawOffset);
  }

  if (!options.interactive) {
    return null;
  }

  const response = await text({
    ...withDefaultValue(
      typeof options.rawOffset === "number"
        ? String(options.rawOffset)
        : options.rawOffset,
    ),
    message: "UTC offset hours (for example -6)",
    placeholder: "-6",
    validate(value) {
      try {
        parseOffsetHours(value);
        return;
      } catch (error) {
        return error instanceof Error ? error.message : String(error);
      }
    },
  });

  if (isCancel(response)) {
    cancel("Greeting cancelled.");
    return null;
  }

  return parseOffsetHours(response);
}

async function resolveGreetingOffsetHoursFromPrompt(
  offsetHours: number,
  interactive: boolean,
): Promise<null | number> {
  const zones = zonesAroundOffset(offsetHours);
  if (zones.length === 0) {
    throwValidationError(
      `No time zones were found near UTC offset ${offsetHours}.`,
    );
  }

  const initialValue = defaultZoneForOffset(offsetHours, zones);
  const initialOffsetHours = offsetHoursForZone(initialValue);

  if (!interactive) {
    return initialOffsetHours;
  }

  const options = toTimeZonePromptOptions(zones);
  const response = await select({
    initialValue: initialOffsetHours,
    message: `Select a time zone near UTC${formatOffset(offsetHours)}`,
    options,
  });

  if (isCancel(response)) {
    cancel("Greeting cancelled.");
    return null;
  }

  return response;
}

async function runGreet(
  name: string | undefined,
  options: GreetOptions,
): Promise<void> {
  const promptMode = parsePromptMode(options.interactive);
  const canPrompt = promptMode !== "never";
  const promptAll = promptMode === "always";

  if (!canPrompt && (!name || !options.offset)) {
    throwValidationError(
      "Name and --offset are required when --interactive no is set.",
    );
  }

  const resolvedName =
    promptAll || (!name && canPrompt)
      ? await resolveGreetingName(name, true)
      : (name ?? null);
  if (!resolvedName) {
    return;
  }

  const resolvedOffsetHours = await resolveGreetingOffsetHours({
    interactive: canPrompt,
    promptAll,
    rawOffset: options.offset,
  });
  if (resolvedOffsetHours === null) {
    if (!canPrompt) {
      throwValidationError(
        "Name and --offset are required when --interactive no is set.",
      );
    }
    return;
  }

  const resolvedOffsetHoursFromPrompt =
    await resolveGreetingOffsetHoursFromPrompt(resolvedOffsetHours, canPrompt);
  if (resolvedOffsetHoursFromPrompt === null) {
    return;
  }

  try {
    const message = await greetCommand.execute({
      args: [resolvedName],
      options: {
        offsetHours: resolvedOffsetHoursFromPrompt,
      },
    });

    outro(message);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!canPrompt) {
      throwValidationError(message);
    }
    console.error(message);
    return;
  }
}

function throwValidationError(message: string): never {
  throw new Error(message);
}

function toTimeZonePromptOptions(
  zones: string[],
): Array<{ label: string; value: number }> {
  return zones.map((zone) => ({
    label: `${zone} (UTC${formatOffset(offsetHoursForZone(zone))})`,
    value: offsetHoursForZone(zone),
  }));
}

function withDefaultValue(value: string | undefined): {
  defaultValue?: string;
} {
  if (typeof value === "string") {
    return { defaultValue: value };
  }
  return {};
}

function zonesAroundOffset(
  offsetHours: number,
  windowHours = 2,
  maxZones = 12,
  now = new Date(),
): string[] {
  const targetOffsetMinutes = Math.round(offsetHours * 60);
  const windowMinutes = windowHours * 60;
  const supported = Intl.supportedValuesOf("timeZone");
  const preferred = preferredZoneForOffset(offsetHours);

  const inWindow = supported
    .map((zone) => ({
      offsetMinutes: timeZoneUtcOffsetMinutes(zone, now),
      zone,
    }))
    .filter(
      (entry): entry is { offsetMinutes: number; zone: string } =>
        entry.offsetMinutes !== null &&
        Math.abs(entry.offsetMinutes - targetOffsetMinutes) <= windowMinutes,
    )
    .sort((a, b) => {
      const distanceA = Math.abs(a.offsetMinutes - targetOffsetMinutes);
      const distanceB = Math.abs(b.offsetMinutes - targetOffsetMinutes);
      if (distanceA !== distanceB) {
        return distanceA - distanceB;
      }
      return a.zone.localeCompare(b.zone);
    })
    .map((entry) => entry.zone);

  if (preferred && inWindow.includes(preferred)) {
    return [preferred, ...inWindow.filter((zone) => zone !== preferred)].slice(
      0,
      maxZones,
    );
  }

  return inWindow.slice(0, maxZones);
}
