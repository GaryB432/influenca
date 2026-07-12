# Influenca Engineering Standards

This document serves as the foundational mandate for all development within the `influenca` repository.

## 🎯 Core Philosophy: Interactive-First

The `influenca` CLI is designed to be helpful and frictionless. It should guide the user through the process rather than failing abruptly.

### Argument Resolution Hierarchy

To prevent "missing argument" errors, commands should define arguments as optional (`[arg]`) and resolve them in the following order:

1.  **Explicit CLI Argument**: Provided via the command line.
2.  **Environment Variable**: Fall back to relevant environment variables (e.g., `INFLUENCA_MEDIA` for manifest directories).
3.  **Interactive Prompt**: Use `@clack/prompts` to request the missing value from the user.

### User Experience (UX)

- **Tooling**: Exclusively use `@clack/prompts` for interactive inputs.
- **Defaults**: Always provide sensible default values in prompts, sourced from environment variables or previous context.
- **Graceful Exit**: Handle prompt cancellations (`isCancel`) by informing the user and exiting cleanly.

## 🛠 Technical Standards

### CLI Architecture

- **Command Pattern**: All CLI commands must implement the `CliCommand<TOptions>` interface defined in `command-contract.ts`.
- **Structure**:
  - Implementations: `packages/cli/src/commands/*.ts`
  - Orchestration: `packages/cli/src/main.ts`
- **Expanding the CLI**: When implementing a new command, activate the `add-command-workflow` skill to ensure consistent registration and wiring.

### Validation & Quality

- **Linting**: `pnpm run lint` is a mandatory check. No task is complete until the linter passes.
- **Build Verification**: Changes to the CLI must be verified with `pnpm --filter @influenca/cli run build`.

## 📦 Workspace Structure

- `packages/cli`: The entry point and command orchestration.
- `packages/core`: Core business logic, time utilities, and shared types.
- `fixtures/`: Sample data (e.g., `influenca.json`) used for development and testing.

## 📝 Data Manifests

The `influenca.json` file is the source of truth for processed media. It contains:

- **Encoding Stats**: Bitrate, FPS, and total frame count.
- **Frame Samples**: Periodically sampled frame data (checksums, mean, and stdev) for motion and quality analysis.
