---
name: add-command-workflow
description: Use when the user asks to create a new command.
---

# Add an arbitrary command: `promote`

## 1. Create the command implementation

Create `packages/cli/src/commands/promote-command.ts`:

```ts
import { type CliCommand, type ParsedCommandArgs } from "./command-contract.js";

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

    return `${name} is now promoted to ${input.options.level}.`;
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

  if (!interactive && !name) {
    throw new Error("Name is required when --no-interactive is set.");
  }

  const resolvedName = name ?? "teammate";

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
