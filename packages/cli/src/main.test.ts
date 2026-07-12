import assert from "node:assert";
import { mock, test } from "node:test";

import { main } from "./main.js";

test("prints help for unknown command", async () => {
  let output = "";
  const writeMock = mock.method(process.stdout, "write", (chunk: string) => {
    output += chunk;
    return true;
  });

  await main(["node", "bin.js", "unknown"]);

  assert.match(output, /Usage:/);
  assert.match(output, /ascession/);
  assert.match(output, /analyze/);

  writeMock.mock.restore();
  mock.reset();
});

test("prints ascession command help", async () => {
  let output = "";
  const writeMock = mock.method(process.stdout, "write", (chunk: string) => {
    output += chunk;
    return true;
  });

  await main(["node", "bin.js", "ascession", "--help"]);

  assert.match(output, /ascession \[inputDir\]/);
  assert.match(output, /--output <path>/);
  assert.match(output, /--dry-run/);

  writeMock.mock.restore();
  mock.reset();
});

test("prints analyze command help", async () => {
  let output = "";
  const writeMock = mock.method(process.stdout, "write", (chunk: string) => {
    output += chunk;
    return true;
  });

  await main(["node", "bin.js", "analyze", "--help"]);

  assert.match(output, /analyze \[inputDir\]/);

  writeMock.mock.restore();
  mock.reset();
});
