import { describe, expect, it } from "vitest";

import { formatSummary } from "./accession-command";

describe("captions", () => {
  it("greets with module prefix", () => {
    expect(
      formatSummary({
        failedFiles: 0,
        manifestPath: "",
        matchedFiles: 0,
        outDir: "",
        processedFiles: 0,
        transcribedFiles: 0,
      }),
    ).toMatch(/analyze/);
  });
});
