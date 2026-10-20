import { basename } from "node:path";

/**
 * How to type this CLI the way it was just started, for hints that can be pasted back:
 * "pnpm influenca" when a pnpm script ran this file, otherwise plain "influenca".
 */
export function invocation(
  env: NodeJS.ProcessEnv = process.env,
  entry = process.argv[1] ?? "",
): string {
  const {
    npm_config_user_agent: agent,
    npm_lifecycle_event: script,
    npm_lifecycle_script: runs,
  } = env;
  // `pnpm test` is a script too, but not one that runs this file.
  const ranUs = entry !== "" && runs?.includes(basename(entry));
  return script && agent?.startsWith("pnpm/") && ranUs
    ? `pnpm ${script}`
    : "influenca";
}
