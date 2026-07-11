import assert from "node:assert";
import { describe, test } from "node:test";

import { add, greet, meaning } from "./motion.js";

describe("Motion", () => {
  test("adds", () => {
    assert.equal(add(2, 3), 5);
  });
  test("greets", () => {
    assert.match(greet("world"), /motion says: hello to world/);
  });
  test("meaning", () => {
    assert.equal(meaning.life, 42);
  });
});
