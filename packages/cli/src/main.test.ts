import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { mock, test } from "node:test";

import { main } from "./main.js";

test("prints help for unknown command shape", async () => {
  let output = "";
  const writeMock = mock.method(process.stdout, "write", (chunk: string) => {
    output += chunk;
    return true;
  });

  await main(["node", "bin.js", "Alice", "America/Chicago"]);

  assert.match(output, /Usage:/);
  assert.match(output, /greet \[name\]/);

  writeMock.mock.restore();
});

test("matches greet command with positional name", async () => {
  let stderr = "";
  const stderrMock = mock.method(process.stderr, "write", (chunk: string) => {
    stderr += chunk;
    return true;
  });

  await main([
    "node",
    "bin.js",
    "greet",
    "bob",
    "--no-interactive",
    "--offset=-6",
  ]);

  assert.doesNotMatch(stderr, /Usage:/);

  stderrMock.mock.restore();
});

test("prints greet command help", async () => {
  let output = "";
  const writeMock = mock.method(process.stdout, "write", (chunk: string) => {
    output += chunk;
    return true;
  });

  await main(["node", "bin.js", "greet", "--help"]);

  assert.match(output, /greet \[name\]/);
  assert.match(output, /--offset <hours>/);
  assert.match(output, /--no-interactive/);

  writeMock.mock.restore();
});

test("greet supports --no-interactive boolean flag", async () => {
  await assert.doesNotReject(async () => {
    await main(["node", "bin.js", "greet", "bob", "--no-interactive"]);
  });
});

test("prints accession command help", async () => {
  let output = "";
  const writeMock = mock.method(process.stdout, "write", (chunk: string) => {
    output += chunk;
    return true;
  });

  try {
    await main(["node", "bin.js", "accession", "--help"]);

    assert.match(output, /accession \[inDir\]/);
    assert.match(output, /--out-dir <path>/);
    assert.match(output, /--timestamp/);
    assert.match(output, /--dry-run/);
    assert.match(output, /--open-ai-key <key>/);
    assert.match(output, /--transcribe/);
    assert.match(output, /--interactive/);
  } finally {
    writeMock.mock.restore();
  }
});

test("accession requires inDir", async () => {
  await assert.rejects(async () => {
    await main([
      "node",
      "bin.js",
      "accession",
      "--no-interactive",
      "--dry-run",
    ]);
  }, /inDir is required in --no-interactive mode\. Provide \[inDir\]\./i);
});

test("accession resolves outDir from INFLUENCA_DIR in non-interactive mode", async () => {
  const originalOutDir = process.env.INFLUENCA_DIR;
  process.env.INFLUENCA_DIR = "tmp/from-env";

  let output = "";
  const logMock = mock.method(console, "log", (...args: unknown[]) => {
    output += `${args.map(String).join(" ")}\n`;
  });

  try {
    await assert.doesNotReject(async () => {
      await main([
        "node",
        "bin.js",
        "accession",
        "../../fixtures",
        "--no-interactive",
        "--dry-run",
        "--no-timestamp",
      ]);
    });

    assert.match(output, /in tmp\/from-env\./);
  } finally {
    logMock.mock.restore();
    if (typeof originalOutDir === "undefined") {
      delete process.env.INFLUENCA_DIR;
    } else {
      process.env.INFLUENCA_DIR = originalOutDir;
    }
  }
});

test("accession appends timestamp to outDir by default", async () => {
  const nowMock = mock.method(Date, "now", () => {
    return Date.parse("2026-07-15T17:03:16.735Z");
  });

  let output = "";
  const logMock = mock.method(console, "log", (...args: unknown[]) => {
    output += `${args.map(String).join(" ")}\n`;
  });

  try {
    await main([
      "node",
      "bin.js",
      "accession",
      "../../fixtures",
      "--dry-run",
      "--out-dir",
      "tmp/demo",
      "--no-interactive",
    ]);

    assert.match(output, /in tmp\/demo\/2026-07-15T17:03:16\.735Z\./);
  } finally {
    nowMock.mock.restore();
    logMock.mock.restore();
  }
});

test("prints analyze command help", async () => {
  let output = "";
  const writeMock = mock.method(process.stdout, "write", (chunk: string) => {
    output += chunk;
    return true;
  });

  try {
    await main(["node", "bin.js", "analyze", "--help"]);

    assert.match(output, /analyze \[inDir\]/);
    assert.match(output, /--minimal/);
  } finally {
    writeMock.mock.restore();
  }
});

test("analyze requires inDir", async () => {
  await assert.rejects(async () => {
    await main(["node", "bin.js", "analyze"]);
  }, /inDir is required\. Provide \[inDir\]\./i);
});

test("analyze minimal summarizes video count from manifest", async () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "influenca-analyze-"));
  const manifestPath = path.join(tmpRoot, ".influenca.json");

  fs.writeFileSync(
    manifestPath,
    JSON.stringify(
      {
        "one.mp4": { stats: { duration_seconds: 5, frames: 120 } },
        "two.mp4": { stats: { duration_seconds: 9, frames: 240 } },
      },
      null,
      2,
    ),
  );

  let output = "";
  const writeMock = mock.method(process.stdout, "write", (chunk: string) => {
    output += chunk;
    return true;
  });

  try {
    await main(["node", "bin.js", "analyze", tmpRoot]);
    assert.match(output, /Analyze minimal: 2 video\(s\) listed/);
  } finally {
    writeMock.mock.restore();
    fs.rmSync(tmpRoot, { force: true, recursive: true });
  }
});
