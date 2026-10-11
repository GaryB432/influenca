import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { loadEnv, userEnvFile } from "./env.js";

describe("userEnvFile", () => {
  it("sits in the XDG config directory, which defaults to ~/.config", () => {
    expect(userEnvFile({ XDG_CONFIG_HOME: "/cfg" })).toBe(
      join("/cfg", "influenca", ".env"),
    );
    expect(userEnvFile({})).toBe(
      join(homedir(), ".config", "influenca", ".env"),
    );
  });
});

describe("loadEnv", () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "influenca-"));
    // Stubbed so that whatever a file sets is taken back out afterwards.
    vi.stubEnv("INFLUENCA_TEST_A", undefined);
    vi.stubEnv("INFLUENCA_TEST_B", undefined);
    vi.stubEnv("INFLUENCA_TEST_C", undefined);
  });
  afterEach(async () => {
    vi.unstubAllEnvs();
    await rm(dir, { force: true, recursive: true });
  });

  it("lets the environment win, then the earliest file, and skips missing files", async () => {
    vi.stubEnv("INFLUENCA_TEST_A", "from the environment");
    const near = join(dir, "near.env");
    const far = join(dir, "far.env");
    await writeFile(near, "INFLUENCA_TEST_A=near\nINFLUENCA_TEST_B=near\n");
    await writeFile(far, "INFLUENCA_TEST_B=far\nINFLUENCA_TEST_C=far\n");

    loadEnv(join(dir, "missing.env"), near, far);

    expect(process.env.INFLUENCA_TEST_A).toBe("from the environment");
    expect(process.env.INFLUENCA_TEST_B).toBe("near");
    expect(process.env.INFLUENCA_TEST_C).toBe("far");
  });
});
