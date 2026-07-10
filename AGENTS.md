# Agent Instructions

This CLI uses a command-per-file pattern under `packages/cli/src/commands` and wires each command in `packages/cli/src/main.ts`.

## Feature Work

When you are the main/orchestrator agent and the user asks to create a new command, load and follow add-command-workflow skill before making code changes.

## General Rules

### Think Before Coding

- State assumptions, uncertainty, and meaningful tradeoffs explicitly.
- If a request has multiple reasonable interpretations, present them or ask before choosing.
- Push back when a simpler approach would satisfy the goal.
- Stop when confused. Name what is unclear and ask for clarification.

### Keep Changes Simple And Surgical

- Use the minimum code that solves the approved goal.
- Touch only files needed for the request.
- Match the existing style and project patterns.
- Do not add speculative features, abstractions, configurability, or unrelated cleanup.
- Preserve user changes. Do not revert work you did not make.
- Remove only unused code created by your own change.

### Verify And Report

- Define success criteria for non-trivial work.
- Run focused checks that match the risk and scope.
- If verification fails, debug the implementation before weakening checks.
- Final responses should summarize what changed, how it was verified, and any unresolved issues.
