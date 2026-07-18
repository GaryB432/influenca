---
name: add-command-workflow
description: Use when the user asks to create a new command.
---

# Add a new CLI command (generic workflow)

Use this whenever a user asks for a new command (for example `analyze`, `accession`, `promote`).

## 0. Gather the command contract first

Before editing code, confirm and restate:

1. Command name and positional args.
2. Option names, types, defaults, and aliases.
3. Whether a workflow already exists.
4. Expected output (console message, file writes, JSON, etc.).
5. Validation rules and error messages.

If anything is missing, ask concise follow-up questions.

## 1. Implement the command class

Create `packages/cli/src/commands/<command-name>-command.ts`.

Always import command contracts from `../command-contract.js` (not `./command-contract.js`).

Template:

```ts
import {
  type CliCommand,
  type ParsedCommandArgs,
} from "../command-contract.js";

export type CommandOptions = {
  // define typed options here
};

export class CommandNameCommand implements CliCommand<CommandOptions> {
  public async execute(
    input: ParsedCommandArgs<CommandOptions>,
  ): Promise<string> {
    const [requiredArg] = input.args;
    if (!requiredArg) {
      throw new Error("requiredArg is required.");
    }

    // Run command logic or call a workflow module.
    return "Command completed.";
  }
}
```

## 2. Decide workflow strategy

Pick one path:

1. Existing workflow path.
   Use an existing module and call it from the command class.

2. No pre-existing workflow path (common for new commands like `analyze`).
   Create a new module such as `packages/cli/src/<command-name>-workflow.ts` with:

- typed input options
- pure helper functions where possible
- a single orchestrator function exported for reuse and testing

Keep side effects (filesystem, network, subprocesses) inside small isolated functions.

## 3. Register the command in CLI entry

Update `packages/cli/src/main.ts`:

1. Import and instantiate the command near other command instances.
2. Add `.command(...)` with positional args.
3. Add `.option(...)` entries that match the requested flags.
4. Add a runner function (for example `runAnalyze`) that:

- normalizes defaults
- performs lightweight validation
- calls `command.execute(...)`
- prints result via `outro(...)` or `console.log(...)` consistently with existing style

Notes:

1. `--help` is handled by `cac` automatically via existing top-level help wiring.
2. Boolean flags should default explicitly in runner code (`?? false`) if behavior matters.
3. For secret-like values (for example API keys), prefer option value first, then env fallback.

## 4. Add focused tests

Update `packages/cli/src/main.test.ts`:

1. Command help test.
   Assert command name and critical options are shown.

2. Required argument validation test.
   For required positional args, `cac` may throw before custom code runs, so assert the parser error text if needed.

3. One behavior test for command-specific logic.
   Prefer pure helper tests when possible to avoid I/O/network.

## 5. Build and test

From repo root:

```bash
pnpm --filter @influenca/cli run build
pnpm --filter @influenca/cli run test
```

If failures occur, fix root cause and rerun both commands.

## 6. Smoke test the command

Use a minimal safe invocation (often dry-run if available):

```bash
node packages/cli/dist/bin.mjs <command-name> ...args
```

Confirm output is understandable and validation errors are actionable.

## 7. Definition of done

Only finish when all are true:

1. New command file exists with typed options.
2. `main.ts` command registration and runner are wired.
3. Tests added or updated for help and required args.
4. CLI build passes.
5. CLI tests pass.
6. Smoke test command runs successfully.
