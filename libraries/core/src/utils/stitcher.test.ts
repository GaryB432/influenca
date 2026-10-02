import { describe, expect, it } from "vitest";

import { add } from "./stitcher";

describe("oven", () => {
  it("should add", () => {
    expect(add(3, 2, 1)).toEqual(1 + 2 + 3);
  });
});
