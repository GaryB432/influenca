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
    ).toMatchInlineSnapshot(`
      "[1m[38;5;177mAccession stats[0m[0m
      [38;5;147m-----------------------------[0m
      [38;5;81mfailedFiles      :[0m [38;5;221m0[0m
      [38;5;81mmanifest         :[0m [38;5;121m[0m
      [38;5;81mmatched files    :[0m [38;5;221m0[0m
      [38;5;81moutput dir       :[0m [38;5;121m[0m
      [38;5;81mprocessed files  :[0m [38;5;221m0[0m
      [38;5;81mtranscribed files:[0m [38;5;221m0[0m"
    `);
  });
});
