import assert from "node:assert";
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
  mock.reset();
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
    "--interactive",
    "no",
    "--offset=-6",
  ]);

  assert.doesNotMatch(stderr, /Usage:/);

  stderrMock.mock.restore();
  mock.reset();
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
  assert.match(output, /--interactive <mode>/);

  writeMock.mock.restore();
  mock.reset();
});

test("greet requires --offset in strict non-interactive mode", async () => {
  await assert.rejects(
    async () => {
      await main([
        "node",
        "bin.js",
        "greet",
        "bob",
        "--interactive",
        "no",
      ]);
    },
    /Name and --offset are required/i,
  );
});
