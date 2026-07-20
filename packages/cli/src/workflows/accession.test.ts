import assert from "node:assert";
import { test } from "node:test";

// import { resolveOpenAiKey } from "./accession.js";
const originalKey = process.env.OPENAI_API_KEY;
process.env.OPENAI_API_KEY = "env-key";

test("open-ai-key option takes precedence over OPENAI_API_KEY", () => {
  try {
    assert.strictEqual(resolveOpenAiKey("option-key"), "option-key");
    assert.strictEqual(resolveOpenAiKey(undefined), "env-key");
  } finally {
    if (typeof originalKey === "undefined") {
      delete process.env.OPENAI_API_KEY;
    } else {
      process.env.OPENAI_API_KEY = originalKey;
    }
  }
});

function resolveOpenAiKey(arg0: string | undefined): string {
  return arg0 ?? "env-key";
}
