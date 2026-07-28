import { describe, expect, it } from "vitest";

describe("console", () => {
  it("adds two numbers", () => {
    expect(add(20, 22)).toBe(42);
  });
});

function add(arg0: number, arg1: number): number {
  return arg0 + arg1;
}
