import { describe, expect, it } from "vitest";

// import { formatSummary } from "./accession-command";
import { maybeColorize } from "./color";

describe("captions", () => {
  it("colorizes appropriately with default color support", () => {
    expect(maybeColorize(-1, "plain old tty")).toEqual("plain old tty");
  });
});
