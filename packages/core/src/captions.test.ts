import assert from "node:assert";
import { describe, test } from "node:test";

import { add, greet, meaning } from "./captions.js";

describe("Captions", () => {
  test("adds", () => {
    assert.equal(add(3, 2), 5);
  });
  test("greets", () => {
    assert.equal(greet("world"), "captions says: hello to world");
  });
  test("meaning", () => {
    assert.equal(meaning.life, 425);
  });
});

const captionsJson = [
  {
    id: "1",
    startTime: 0.5,
    endTime: 3.0,
    text: "Welcome to our video tutorial!",
  },
  {
    id: "2",
    startTime: 3.5,
    endTime: 7.0,
    text: "Today we are learning about SvelteKit.",
  },
];
