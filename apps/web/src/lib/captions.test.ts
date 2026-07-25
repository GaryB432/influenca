import { expect, describe, test } from "vitest";

import { segmentToCue } from "./captions";

describe("Captions", () => {
  test("greets", () => {
    const newLocal = segmentToCue({
      end: 3,
      id: 1,
      start: 0.5,
      text: "Welcome to our video tutorial!",
    });
    expect(newLocal).toEqual({
      endTime: 3,
      id: "1",
      startTime: 0.5,
      text: "Welcome to our video tutorial!",
    });
  });
});
