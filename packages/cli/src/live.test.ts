import { describe, expect, it } from "vitest";

import { clock, fit, meter, renderRow, startTable } from "./live.js";

/** Something to write to that remembers what it was sent. Colors are off under test, so the text is plain. */
function screen(tty?: { columns: number; rows: number }) {
  const sent: string[] = [];
  const out = {
    ...tty,
    isTTY: tty !== undefined,
    write: (text: string) => sent.push(text) > 0,
  } as unknown as NodeJS.WriteStream;
  return { out, sent };
}

const specs = [
  { cells: ["1", "a.mp4", "video"] },
  { cells: ["2", "long-name.mp3", "audio"] },
  { cells: ["10", "c.jpg", "image"] },
];

describe("clock", () => {
  it("is minutes and seconds", () => {
    expect(clock(75)).toBe("1:15");
    expect(clock(4.4)).toBe("0:04");
  });
});

describe("fit", () => {
  it("leaves a line that fits and cuts one that would wrap", () => {
    expect(fit("short", 80)).toBe("short");
    expect(fit("0123456789", 8)).toBe("012345…");
  });
});

describe("meter", () => {
  it("moves in half steps", () => {
    expect(meter(0, 4)).toBe("━━━━");
    expect(meter(0.125, 4)).toBe("╸━━━");
    expect(meter(0.5, 4)).toBe("━━━━");
    expect(meter(2, 4)).toBe("━━━━");
  });
});

describe("renderRow", () => {
  const widths = [2, 13, 5];
  const row = { cells: ["1", "a.mp4", "video"], fraction: 0, weight: 1 };

  it("lines the cells up and puts the result after them", () => {
    expect(
      renderRow({ ...row, state: "done", tail: "copied" }, widths, 0, false),
    ).toBe("   1  a.mp4          video  copied");
  });

  it("shows a meter while the row is being worked on", () => {
    expect(
      renderRow({ ...row, fraction: 0.5, state: "working", tail: "" }, widths),
    ).toMatch(/^⠋ {3}1 {2}a\.mp4 +video {2}━+ {2}50%$/);
  });

  it("leaves nothing trailing on a row with no result yet", () => {
    expect(renderRow({ ...row, state: "waiting", tail: "" }, widths)).toBe(
      "·   1  a.mp4          video",
    );
  });
});

describe("startTable", () => {
  it("away from a terminal, writes each row once, in order, when it is finished", async () => {
    const { out, sent } = screen();
    const table = startTable(specs, out);
    expect(sent).toEqual([]);

    await table.run(
      0,
      async (report) => report(0.5),
      () => "copied",
    );
    table.set(2, "kept");
    // Row 3 is finished but row 2 is not, so it waits its turn.
    expect(sent).toEqual(["   1  a.mp4          video  copied\n"]);

    table.set(1, "nothing to hear", "skipped");
    table.end();
    expect(sent).toEqual([
      "   1  a.mp4          video  copied\n",
      "   2  long-name.mp3  audio  nothing to hear\n",
      "  10  c.jpg          image  kept\n",
    ]);
  });

  it("marks the row that failed, stops, and passes the error on", async () => {
    const { out, sent } = screen();
    const table = startTable(specs, out);
    await expect(
      table.run(
        0,
        () => Promise.reject(new Error("boom")),
        () => "copied",
      ),
    ).rejects.toThrow("boom");
    table.end();
    expect(sent).toEqual(["   1  a.mp4          video  failed\n"]);
  });

  it("in a terminal, hides the cursor while it draws and leaves every row behind", async () => {
    const { out, sent } = screen({ columns: 80, rows: 24 });
    const table = startTable(specs, out);
    expect(sent[0]).toBe("\x1b[?25l");
    // All three rows and the line for the whole job are on screen from the start.
    expect(sent[1]).toContain("·   1  a.mp4");
    expect(sent[1]).toContain("·  10  c.jpg");
    expect(sent[1]).toContain("0 of 3");

    await table.run(
      0,
      async () => undefined,
      () => "copied",
    );
    table.end();
    const left = sent.slice(-4);
    expect(left[0]).toBe("✓   1  a.mp4          video  copied\n");
    expect(left[2]).toBe("·  10  c.jpg          image\n");
    expect(left[3]).toBe("\x1b[?25h");
  });

  it("taller than the terminal, keeps only the working row live", async () => {
    const { out, sent } = screen({ columns: 80, rows: 4 });
    const table = startTable(specs, out);
    expect(sent[1]).not.toContain("a.mp4");

    const done = table.run(
      0,
      async () => undefined,
      () => "copied",
    );
    expect(sent.at(-1)).toContain("⠋   1  a.mp4");
    expect(sent.at(-1)).not.toContain("long-name.mp3");
    await done;
    table.end();
    expect(sent).toContain("✓   1  a.mp4          video  copied\n");
  });
});
