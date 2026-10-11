import { describe, expect, it } from "vitest";

import { invocation } from "./invocation.js";

const entry = "/repo/packages/cli/dist/bin.mjs";
const pnpm = { npm_config_user_agent: "pnpm/12.5.1 npm/? node/? linux x64" };

describe("invocation", () => {
  it("is the pnpm script when one started this file", () => {
    const env = {
      ...pnpm,
      npm_lifecycle_event: "influenca",
      npm_lifecycle_script: "node packages/cli/dist/bin.mjs analyze",
    };
    expect(invocation(env, entry)).toBe("pnpm influenca");
  });

  it("is the bare command when started directly", () => {
    expect(invocation({}, entry)).toBe("influenca");
  });

  it("is the bare command inside some other script, such as the tests", () => {
    const env = {
      ...pnpm,
      npm_lifecycle_event: "test",
      npm_lifecycle_script: "vitest run",
    };
    expect(invocation(env, "/repo/node_modules/vitest/vitest.mjs")).toBe(
      "influenca",
    );
    expect(invocation(env, "")).toBe("influenca");
  });
});
