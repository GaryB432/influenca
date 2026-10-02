import { describe, expect, it } from "vitest";

import { findem } from "./stitcher";

describe("oven", () => {
  it("should add", async () => {
    expect(await findem({})).toEqual({});
  });
});
