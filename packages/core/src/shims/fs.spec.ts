import assert from "node:assert";
import { describe, test } from "node:test";

import { add, greet, meaning } from "./fs.js";

describe("Fs", () => {
  test("adds", () => {
    assert.equal(add(2, 3), 5);
  });
  test("greets", () => {
    assert.equal(greet("world"), "fs says: hello to world");
  });
  test("meaning", () => {
    assert.equal(meaning.life, 42);
  });
});
