import { describe, expect, it } from "vitest";

import { add, greet, meaning } from "./captions";

describe("captions", () => {
  it("greets with module prefix", () => {
    expect(greet("World")).toBe("captions says: hello to World");
  });

  it("adds two numbers", () => {
    expect(add(20, 22)).toBe(42);
  });

  it("exports meaning of life", () => {
    expect(meaning).toEqual({ life: 42 });
  });
});
