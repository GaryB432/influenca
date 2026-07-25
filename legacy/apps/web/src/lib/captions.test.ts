import assert from "node:assert";
import { describe, test } from "node:test";

import { segmentToCue } from "./captions.ts";

describe("Captions", () => {
  test("greets", () => {
    assert.deepStrictEqual(
      segmentToCue({
        end: 3,
        id: 1,
        start: 0.5,
        text: "Welcome to our video tutorial!",
      }),
      {
        endTime: 3,
        id: "1",
        startTime: 0.5,
        text: "Welcome to our video tutorial!",
      },
    );
  });
});
