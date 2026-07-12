---
name: add-command-workflow
description: Use when the user asks to create a new command.
---

# Add an arbitrary command: `promote`

Before starting on a command, add and export a stub module for the command business process in `@influenca/core`. In this arbitrary case of `promote`, this would suffice:

```ts
export async function promoteProcesss(
  name: string,
  level = "senior",
): Promise<string> {
  return `${name} is now promoted to ${level}.`;
}
```

## 1. Create the command implementation

Create `packages/cli/src/commands/promote-command.ts`:

```ts
import { type CliCommand, type ParsedCommandArgs } from "./command-contract.js";
import { promoteProcess } from "@influenca/core";

export type PromoteCommandOptions = {
  level: string;
};

export class PromoteCommand implements CliCommand<PromoteCommandOptions> {
  public async execute(
    input: ParsedCommandArgs<PromoteCommandOptions>,
  ): Promise<string> {
    const [name] = input.args;

    if (!name) {
      throw new Error("Name is required.");
    }

    return promoteProcess(name, input.options.level);
  }
}
```

## 2. Register the command in the CLI entry

Update `packages/cli/src/main.ts`:

1. Add the import and instance near the other commands.
2. Add a `promote [name]` command definition.
3. Add a small runner function that calls `promoteCommand.execute(...)`.

Example wiring:

```ts
import { text } from "@clack/prompts";
import { PromoteCommand } from "./commands/promote-command.js";

const promoteCommand = new PromoteCommand();

type PromoteOptions = {
  level?: string;
  interactive?: boolean;
};

cli
  .command("promote [name]", "Promote someone")
  .option("--level <level>", "Promotion level", { default: "senior" })
  .option("--interactive", "Prompt for values", { default: true })
  .option("--no-interactive", "Disable prompts")
  .action(async (name: string | undefined, options: PromoteOptions) => {
    await runPromote(name, options);
  });

async function runPromote(
  name: string | undefined,
  options: PromoteOptions,
): Promise<void> {
  const interactive = options.interactive ?? true;
  const level = options.level ?? "senior";

  // Resolve Name: CLI -> Env -> Prompt
  let resolvedName = name ?? process.env.INFLUENCA_PROMOTEE;

  if (!resolvedName && interactive) {
    const promptResult = await text({
      message: "Who are we promoting?",
      placeholder: "Enter name...",
    });

    if (promptResult.isCancel) {
      console.log("Promotion cancelled.");
      process.exit(0);
    }
    resolvedName = promptResult;
  }

  if (!resolvedName) {
    throw new Error(
      "Name is required (provide via arg, env, or interactive mode).",
    );
  }

  const message = await promoteCommand.execute({
    args: [resolvedName],
    options: { level },
  });

  console.log(message);
}
```

## 3. Build and test

From the repo root:

```bash
pnpm --filter @influenca/cli run build
pnpm --filter @influenca/cli run test
```

## 4. Try it

After build, run:

```bash
node packages/cli/dist/bin.mjs promote alice --no-interactive --level staff
```
